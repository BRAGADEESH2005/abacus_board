'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, ApiErr } from '@/components/ui/api';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { OtpVerifier } from '@/components/ui/OtpVerifier';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { normalizePhone } from '@/lib/format';
import { USERNAME_RE } from '@/lib/constants';

type UStatus = { state: 'idle' | 'checking' | 'ok' | 'taken' | 'invalid'; suggestions: string[] };

/** Compulsory broker sign up (Broker Side Changes v2, section 1). */
export function SignupForm({ cities, whatsapp }: { cities: string[]; whatsapp: boolean }) {
  const [f, setF] = useState({ fullName: '', username: '', phone: '', altPhone: '', email: '', city: '', company: '', password: '', confirmPassword: '' });
  const [emailTicket, setEmailTicket] = useState('');
  const [emailVerifiedFor, setEmailVerifiedFor] = useState('');
  const [phoneTicket, setPhoneTicket] = useState('');
  const [phoneVerifiedFor, setPhoneVerifiedFor] = useState('');
  const [u, setU] = useState<UStatus>({ state: 'idle', suggestions: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  // Live username check with suggestions built from name and city.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const uname = f.username.trim().toLowerCase();
    if (!uname) {
      setU({ state: 'idle', suggestions: [] });
      return;
    }
    if (!USERNAME_RE.test(uname)) {
      setU((x) => ({ ...x, state: 'invalid' }));
    }
    timer.current = setTimeout(async () => {
      if (USERNAME_RE.test(uname)) setU((x) => ({ ...x, state: 'checking' }));
      try {
        const r = await api<{ valid: boolean; available: boolean; suggestions: string[] }>(
          `/api/auth/username?u=${encodeURIComponent(uname)}&name=${encodeURIComponent(f.fullName)}&city=${encodeURIComponent(f.city)}`,
        );
        setU({ state: !r.valid ? 'invalid' : r.available ? 'ok' : 'taken', suggestions: r.suggestions });
      } catch {
        setU({ state: 'idle', suggestions: [] });
      }
    }, 350);
  }, [f.username, f.fullName, f.city]);

  const phoneNorm = normalizePhone(f.phone);
  const emailNorm = f.email.trim().toLowerCase();
  const emailOk = Boolean(emailTicket) && emailVerifiedFor === emailNorm;
  const phoneOk = !whatsapp || (Boolean(phoneTicket) && phoneVerifiedFor === phoneNorm);
  const canCreate = emailOk && phoneOk;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    setBusy(true);
    setError('');
    setFields({});
    try {
      const r = await api<{ redirect: string }>('/api/auth/signup', { body: { ...f, emailTicket, phoneTicket } });
      window.location.assign(r.redirect);
    } catch (err) {
      const e2 = err as ApiErr;
      setError(e2.message);
      setFields(e2.fields ?? {});
      if (e2.fields?.email) setEmailTicket('');
      if (e2.fields?.phone) setPhoneTicket('');
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <form className="box wide" onSubmit={submit} autoComplete="on">
        <div className="bh">
          <h1>Sign up as a broker</h1>
          <p className="muted" style={{ margin: 0 }}>
            {whatsapp ? 'Verify your WhatsApp number and your email to create your account.' : 'Verify your email to create your account.'} After that, you log in with your password.
          </p>
        </div>
        <div className="grid" style={{ padding: '12px 24px 4px' }}>
          <Field label="Full name" req error={fields.fullName} className="full">
            <input autoComplete="name" value={f.fullName} onChange={set('fullName')} required />
          </Field>
          <Field
            label="Username"
            req
            className="full"
            error={fields.username ?? (u.state === 'invalid' ? '4 to 20 characters: lowercase letters, numbers, dot and underscore. No spaces.' : u.state === 'taken' ? 'Taken' : undefined)}
            hint={u.state === 'checking' ? 'Checking…' : u.state === 'ok' ? <span className="okmsg">✓ Available</span> : 'You can log in with this, your phone or your email'}
          >
            <input autoComplete="off" value={f.username} onChange={(e) => setF((x) => ({ ...x, username: e.target.value.toLowerCase().replace(/\s/g, '') }))} required maxLength={20} />
          </Field>
          {(u.state === 'taken' || u.state === 'invalid') && u.suggestions.length > 0 && (
            <div className="full row-flex small">
              <span className="muted">Try:</span>
              {u.suggestions.map((s) => (
                <button type="button" key={s} className="chip" style={{ border: 0, cursor: 'pointer' }} onClick={() => setF((x) => ({ ...x, username: s }))}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <Field label={whatsapp ? 'Primary phone (WhatsApp)' : 'Primary phone'} req error={fields.phone} hint={whatsapp ? 'Must be on WhatsApp. We send a code there.' : '+91 is added for you'}>
            <input type="tel" autoComplete="tel" placeholder="+91 98xxx xxxxx" value={f.phone} onChange={set('phone')} required disabled={whatsapp && phoneOk} />
          </Field>
          <div className="f" style={{ justifyContent: 'flex-end' }}>
            {whatsapp ? (
              <OtpVerifier
                purpose="signup"
                channel="whatsapp"
                target={phoneNorm ?? ''}
                verified={phoneOk}
                disabled={!phoneNorm}
                onVerified={(t, target) => {
                  setPhoneTicket(t);
                  setPhoneVerifiedFor(target);
                }}
              />
            ) : (
              <span className="hint">WhatsApp verification is switched off on this board; the number is saved unverified.</span>
            )}
          </div>
          <Field label="Alternate phone" hint="Optional, no code needed">
            <input type="tel" value={f.altPhone} onChange={set('altPhone')} />
          </Field>
          <span />
          <Field label="Email" req error={fields.email}>
            <input type="email" autoComplete="email" value={f.email} onChange={set('email')} required disabled={emailOk} />
          </Field>
          <div className="f" style={{ justifyContent: 'flex-end' }}>
            <OtpVerifier
              purpose="signup"
              channel="email"
              target={emailNorm}
              verified={emailOk}
              disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)}
              onVerified={(t, target) => {
                setEmailTicket(t);
                setEmailVerifiedFor(target);
              }}
            />
          </div>
          <Field label="City based in" req error={fields.city}>
            <select value={f.city} onChange={set('city')} required>
              <option value="">Choose</option>
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Company name" req error={fields.company}>
            <input autoComplete="organization" value={f.company} onChange={set('company')} required />
          </Field>
          <Field label="Password" req error={fields.password} hint="At least 8 characters with a number">
            <PasswordInput autoComplete="new-password" value={f.password} onChange={set('password')} required />
          </Field>
          <Field label="Confirm password" req error={fields.confirmPassword ?? (f.confirmPassword && f.confirmPassword !== f.password ? 'Passwords do not match' : undefined)}>
            <PasswordInput autoComplete="new-password" value={f.confirmPassword} onChange={set('confirmPassword')} required />
          </Field>
        </div>
        <div className="bb">
          {error && <div className="notice">{error}</div>}
          <Button className="primary" type="submit" loading={busy} disabled={!canCreate || u.state === 'taken' || u.state === 'invalid'}>
            Create account
          </Button>
          {!canCreate && <span className="hint">{whatsapp ? 'Both codes must be verified before you can create the account.' : 'Verify your email before you can create the account.'}</span>}
        </div>
        <div className="bf">
          Already signed up? <Link href="/login">Log in</Link>
        </div>
      </form>
    </div>
  );
}
