'use client';
import { useEffect, useState } from 'react';
import { api, ApiErr } from './api';
import { Button } from './Button';

type Props = {
  purpose: 'signup' | 'change_email' | 'change_phone';
  channel: 'email' | 'whatsapp';
  target: string;
  verified: boolean;
  onVerified: (ticket: string, target: string) => void;
  disabled?: boolean;
  label?: string;
};

function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Send, countdown (valid 10 minutes), resend after 60 seconds, verify. */
export function OtpVerifier({ purpose, channel, target, verified, onVerified, disabled, label }: Props) {
  const [otpId, setOtpId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState<'send' | 'verify' | null>(null);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  useEffect(() => {
    if (!otpId) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [otpId]);

  // A changed target means the old code no longer applies.
  useEffect(() => {
    if (sentTo && target.trim().toLowerCase() !== sentTo) {
      setOtpId(null);
      setCode('');
      setError('');
    }
  }, [target, sentTo]);

  if (verified) return <span className="verified">✓ Verified</span>;

  const send = async () => {
    setBusy('send');
    setError('');
    try {
      const r = await api<{ otpId: string; expiresInSec: number; resendInSec: number }>('/api/auth/otp/send', { body: { purpose, channel, target } });
      setOtpId(r.otpId);
      setExpiresAt(Date.now() + r.expiresInSec * 1000);
      setResendAt(Date.now() + r.resendInSec * 1000);
      setNow(Date.now());
      setSentTo(target.trim().toLowerCase());
      setCode('');
    } catch (e) {
      const err = e as ApiErr;
      setError(err.fields?.target ?? err.message);
      if (err.data?.retryAfter) setResendAt(Date.now() + Number(err.data.retryAfter) * 1000);
    } finally {
      setBusy(null);
    }
  };

  const verify = async () => {
    if (!otpId) return;
    setBusy('verify');
    setError('');
    try {
      const r = await api<{ ticket: string; target: string }>('/api/auth/otp/verify', { body: { otpId, code, purpose } });
      onVerified(r.ticket, r.target);
    } catch (e) {
      setError((e as ApiErr).message);
    } finally {
      setBusy(null);
    }
  };

  const left = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  if (!otpId) {
    return (
      <span className="stack" style={{ gap: 4 }}>
        <span>
          <Button type="button" className="small" onClick={send} loading={busy === 'send'} disabled={disabled || !target.trim() || resendIn > 0}>
            {label ?? (channel === 'email' ? 'Send email code' : 'Send WhatsApp code')}
          </Button>
        </span>
        {error && <span className="err">{error}</span>}
      </span>
    );
  }

  return (
    <span className="stack" style={{ gap: 6 }}>
      <span className="otp-row">
        <input
          className="input"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="6 digits"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (code.length === 6) verify();
            }
          }}
          aria-label="Verification code"
        />
        <Button type="button" className="small primary" onClick={verify} loading={busy === 'verify'} disabled={code.length !== 6 || left === 0}>
          Verify
        </Button>
        {resendIn > 0 ? (
          <span className="muted">Resend in {resendIn}s</span>
        ) : (
          <Button type="button" className="small ghost" onClick={send} loading={busy === 'send'}>
            Resend code
          </Button>
        )}
      </span>
      <span className="hint">
        {left > 0 ? `Sent to ${sentTo}. Valid for ${mmss(left)}.` : 'This code has expired. Ask for a new one.'}
      </span>
      {error && <span className="err">{error}</span>}
    </span>
  );
}
