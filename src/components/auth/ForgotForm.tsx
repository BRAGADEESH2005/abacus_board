'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiErr } from '@/components/ui/api';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useToast } from '@/components/ui/Toast';

/** Forgot password: OTP on email (or WhatsApp for brokers when switched on), then a new password. */
export function ForgotForm({ role, whatsapp }: { role: 'broker' | 'admin'; whatsapp: boolean }) {
  const toast = useToast();
  const [identifier, setIdentifier] = useState('');
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
  const [otpId, setOtpId] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [expiresAt, setExpiresAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!otpId) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [otpId]);

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ otpId: string; expiresInSec: number; resendInSec: number }>('/api/auth/forgot', { body: { role, identifier, channel } });
      setOtpId(r.otpId);
      setExpiresAt(Date.now() + r.expiresInSec * 1000);
      setResendAt(Date.now() + r.resendInSec * 1000);
      setNow(Date.now());
      toast(channel === 'email' ? 'If that account exists, a code is on its way to its email.' : 'If that account exists, a code is on its way on WhatsApp.');
    } catch (e) {
      const err = e as ApiErr;
      setError(err.message);
      if (err.data?.retryAfter) setResendAt(Date.now() + Number(err.data.retryAfter) * 1000);
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFields({});
    try {
      const r = await api<{ redirect: string }>('/api/auth/reset', { body: { otpId, code, password, confirmPassword: confirm } });
      toast('Password changed. Log in with your new password.', 'success');
      setTimeout(() => window.location.assign(r.redirect), 900);
    } catch (e2) {
      const err = e2 as ApiErr;
      setError(err.message);
      setFields(err.fields ?? {});
      setBusy(false);
    }
  };

  const left = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const loginHref = role === 'admin' ? '/admin/login' : '/login';

  return (
    <div className="auth">
      <form className="box" onSubmit={otpId ? reset : (e) => (e.preventDefault(), send())}>
        <div className="bh">
          <h1>Reset your password</h1>
          <p className="muted" style={{ margin: 0 }}>We send a 6 digit code that is valid for 10 minutes.</p>
        </div>
        <div className="bb">
          <Field label={role === 'admin' ? 'Admin email' : 'Username, phone or email'}>
            <input autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required disabled={Boolean(otpId)} autoFocus />
          </Field>
          {role === 'broker' && whatsapp && !otpId && (
            <div className="row-flex">
              <span className="small">Send the code by</span>
              <div className="seg">
                <button type="button" aria-pressed={channel === 'email'} onClick={() => setChannel('email')}>
                  Email
                </button>
                <button type="button" aria-pressed={channel === 'whatsapp'} onClick={() => setChannel('whatsapp')}>
                  WhatsApp
                </button>
              </div>
            </div>
          )}
          {!otpId ? (
            <Button className="primary" type="submit" loading={busy} disabled={resendIn > 0}>
              Send code
            </Button>
          ) : (
            <>
              <Field label="Code" hint={left > 0 ? `Valid for ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Expired. Ask for a new code.'} error={fields.code}>
                <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required />
              </Field>
              <Field label="New password" hint="At least 8 characters with a number" error={fields.password}>
                <PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </Field>
              <Field label="Confirm new password" error={fields.confirmPassword}>
                <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </Field>
              <div className="row-flex">
                <Button className="primary" type="submit" loading={busy}>
                  Set new password
                </Button>
                {resendIn > 0 ? (
                  <span className="muted">Resend in {resendIn}s</span>
                ) : (
                  <Button type="button" className="ghost small" onClick={send}>
                    Resend code
                  </Button>
                )}
              </div>
            </>
          )}
          {error && <div className="notice">{error}</div>}
        </div>
        <div className="bf">
          Remembered it? <Link href={loginHref}>Back to login</Link>
        </div>
      </form>
    </div>
  );
}
