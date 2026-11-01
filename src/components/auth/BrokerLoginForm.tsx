'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, ApiErr } from '@/components/ui/api';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';

export function BrokerLoginForm() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ redirect: string }>('/api/auth/login', { body: { identifier, password, remember } });
      window.location.assign(r.redirect);
    } catch (err) {
      setError((err as ApiErr).message);
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <form className="box" onSubmit={submit} method="post" action="/api/auth/login">
        <div className="bh">
          <h1>Broker login</h1>
          <p className="muted" style={{ margin: 0 }}>Use your username, phone or email with your password.</p>
        </div>
        <div className="bb">
          <Field label="Username, phone or email">
            <input name="username" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus />
          </Field>
          <Field label="Password">
            <PasswordInput name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <div className="spread">
            <label className="row-flex small" style={{ gap: 6 }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ accentColor: 'var(--maroon)' }} />
              Remember me for 30 days
            </label>
            <Link className="small" href="/forgot-password">
              Forgot password?
            </Link>
          </div>
          {error && <div className="notice">{error}</div>}
          <Button className="primary" type="submit" loading={busy}>
            Log in
          </Button>
        </div>
        <div className="bf">
          New to the board? <Link href="/signup">Sign up</Link>
        </div>
      </form>
    </div>
  );
}
