'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiErr } from '@/components/ui/api';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';

type LoginRes = { redirect?: string; otpRequired?: boolean; otpId?: string; expiresInSec?: number; resendInSec?: number; email?: string; firstLogin?: boolean };

/** Admin login: password, then an email code only on the first login or a new browser. */
export function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'creds' | 'otp'>('creds');
  const [otp, setOtp] = useState<LoginRes | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (step !== 'otp') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);

  const login = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<LoginRes>('/api/auth/admin/login', { body: { email, password } });
      if (r.redirect) {
        window.location.assign(r.redirect);
        return;
      }
      setOtp(r);
      setStep('otp');
      setCode('');
      setExpiresAt(Date.now() + (r.expiresInSec ?? 600) * 1000);
      setResendAt(Date.now() + (r.resendInSec ?? 60) * 1000);
      setNow(Date.now());
    } catch (err) {
      const e2 = err as ApiErr;
      setError(e2.message);
      if (e2.data?.retryAfter) setResendAt(Date.now() + Number(e2.data.retryAfter) * 1000);
    }
    setBusy(false);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ redirect: string }>('/api/auth/admin/verify-device', { body: { otpId: otp?.otpId, code } });
      window.location.assign(r.redirect);
    } catch (err) {
      setError((err as ApiErr).message);
      setBusy(false);
    }
  };

  const left = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  return (
    <div className="auth">
      {step === 'creds' ? (
        <form className="box" onSubmit={login} method="post">
          <div className="bh">
            <h1>Admin login</h1>
            <p className="muted" style={{ margin: 0 }}>For the Abacus team only. You stay signed in on this browser for 30 days.</p>
          </div>
          <div className="bb">
            <Field label="Email">
              <input type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </Field>
            <Field label="Password">
              <PasswordInput name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <div className="spread">
              <span />
              <Link className="small" href="/admin/forgot-password">
                Forgot password?
              </Link>
            </div>
            {error && <div className="notice">{error}</div>}
            <Button className="primary" type="submit" loading={busy}>
              Log in
            </Button>
          </div>
        </form>
      ) : (
        <form className="box" onSubmit={verify}>
          <div className="bh">
            <h1>{otp?.firstLogin ? 'Verify your email' : 'New browser check'}</h1>
            <p className="muted" style={{ margin: 0 }}>
              We emailed a 6 digit code to {otp?.email}. {otp?.firstLogin ? 'This is a one time check on your first login.' : 'You only need this once on each browser.'}
            </p>
          </div>
          <div className="bb">
            <Field label="Code" hint={left > 0 ? `Valid for ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Expired. Ask for a new code.'}>
              <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus required />
            </Field>
            {error && <div className="notice">{error}</div>}
            <div className="row-flex">
              <Button className="primary" type="submit" loading={busy} disabled={code.length !== 6}>
                Verify and sign in
              </Button>
              {resendIn > 0 ? (
                <span className="muted">Resend in {resendIn}s</span>
              ) : (
                <Button type="button" className="ghost small" onClick={() => login()}>
                  Resend code
                </Button>
              )}
            </div>
            <button type="button" className="linkbtn small" style={{ alignSelf: 'flex-start' }} onClick={() => setStep('creds')}>
              Use a different account
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
