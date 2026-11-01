'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiErr } from '@/components/ui/api';
import { Avatar } from '@/components/ui/Avatar';
import { LevelChip } from '@/components/ui/Badges';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { OtpVerifier } from '@/components/ui/OtpVerifier';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useToast } from '@/components/ui/Toast';
import { displayPhone, fmtDate, normalizePhone } from '@/lib/format';
import { USERNAME_RE } from '@/lib/constants';
import type { LocationList } from '@/lib/settings';
import { AvatarCropper } from './AvatarCropper';

type Profile = {
  fullName: string;
  username: string;
  company: string;
  city: string;
  microMarkets: { city: string; name: string }[];
  phone: string;
  phoneVerified: boolean;
  email: string;
  emailVerified: boolean;
  altPhone: string;
  avatarFileId: string | null;
  memberSince: string;
  nextUsernameChange: string | null;
};

function ContactChange({ kind, current, verified, whatsapp }: { kind: 'email' | 'phone'; current: string; verified: boolean; whatsapp: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const target = kind === 'email' ? value.trim().toLowerCase() : normalizePhone(value) ?? '';
  const canChange = kind === 'email' || whatsapp;
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row-flex">
        <b>{kind === 'email' ? current : displayPhone(current)}</b>
        {verified ? <span className="verified">✓ Verified</span> : <span className="pill p-wait">Not verified</span>}
        {canChange && !open && (
          <button className="linkbtn small" onClick={() => setOpen(true)}>
            Change
          </button>
        )}
      </div>
      {!canChange && <span className="hint">WhatsApp verification is switched off, so the phone number can only be changed by Abacus.</span>}
      {open && (
        <div className="row-flex" style={{ alignItems: 'flex-start' }}>
          <input className="input" style={{ maxWidth: 260 }} type={kind === 'email' ? 'email' : 'tel'} placeholder={kind === 'email' ? 'New email' : 'New WhatsApp number'} value={value} onChange={(e) => setValue(e.target.value)} />
          <OtpVerifier
            purpose={kind === 'email' ? 'change_email' : 'change_phone'}
            channel={kind === 'email' ? 'email' : 'whatsapp'}
            target={target}
            verified={false}
            disabled={!target || busy}
            onVerified={async (ticket, t) => {
              setBusy(true);
              try {
                await api('/api/broker/profile/contact', { body: { kind, value: t, ticket } });
                toast(kind === 'email' ? 'Email changed' : 'Phone changed', 'success');
                setOpen(false);
                setValue('');
                router.refresh();
              } catch (e) {
                toast((e as ApiErr).message, 'error');
              }
              setBusy(false);
            }}
          />
          <button className="btn small ghost" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export function ProfileEditor({ profile, whatsapp, locations, level, ring }: { profile: Profile; whatsapp: boolean; locations: LocationList; level: { key: string; name: string }; ring: { pct: number; next: string | null } }) {
  const toast = useToast();
  const router = useRouter();
  const [f, setF] = useState({ fullName: profile.fullName, company: profile.company, city: profile.city, altPhone: profile.altPhone, microMarkets: profile.microMarkets });
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [username, setUsername] = useState(profile.username);
  const [uState, setUState] = useState<{ s: 'idle' | 'ok' | 'taken' | 'invalid'; sug: string[] }>({ s: 'idle', sug: [] });
  const [uBusy, setUBusy] = useState(false);
  const [crop, setCrop] = useState<File | null>(null);
  const [upBusy, setUpBusy] = useState(false);
  const [pw, setPw] = useState({ current: '', password: '', confirmPassword: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwFields, setPwFields] = useState<Record<string, string>>({});
  const [mmCity, setMmCity] = useState(profile.city);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const u = username.trim().toLowerCase();
    if (u === profile.username) return setUState({ s: 'idle', sug: [] });
    if (!USERNAME_RE.test(u)) return setUState({ s: 'invalid', sug: [] });
    const t = setTimeout(async () => {
      try {
        const r = await api<{ available: boolean; suggestions: string[] }>(`/api/auth/username?u=${encodeURIComponent(u)}&name=${encodeURIComponent(f.fullName)}&city=${encodeURIComponent(f.city)}`);
        setUState({ s: r.available ? 'ok' : 'taken', sug: r.suggestions });
      } catch {
        /* ignore */
      }
    }, 350);
    return () => clearTimeout(t);
  }, [username, profile.username, f.fullName, f.city]);

  const save = async () => {
    setSaving(true);
    setFields({});
    try {
      await api('/api/broker/profile', { method: 'PATCH', body: f });
      toast('Profile saved', 'success');
      router.refresh();
    } catch (e) {
      const err = e as ApiErr;
      setFields(err.fields ?? {});
      toast(err.message, 'error');
    }
    setSaving(false);
  };

  const saveUsername = async () => {
    setUBusy(true);
    try {
      await api('/api/broker/profile/username', { body: { username } });
      toast('Username changed', 'success');
      router.refresh();
    } catch (e) {
      toast((e as ApiErr).message, 'error');
    }
    setUBusy(false);
  };

  const upload = async (blob: Blob) => {
    setUpBusy(true);
    try {
      const form = new FormData();
      form.append('file', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
      await api('/api/broker/profile/avatar', { form });
      toast('Photo updated', 'success');
      setCrop(null);
      router.refresh();
    } catch (e) {
      toast((e as ApiErr).message, 'error');
    }
    setUpBusy(false);
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) return toast('Upload a JPG or PNG image.', 'error');
    if (file.size > 5 * 1024 * 1024) return toast('Keep the photo under 5 MB.', 'error');
    setCrop(file);
  };

  const changePw = async () => {
    setPwBusy(true);
    setPwFields({});
    try {
      await api('/api/broker/profile/password', { body: pw });
      toast('Password changed. Other browsers were logged out.', 'success');
      setPw({ current: '', password: '', confirmPassword: '' });
    } catch (e) {
      const err = e as ApiErr;
      setPwFields(err.fields ?? {});
      toast(err.message, 'error');
    }
    setPwBusy(false);
  };

  const toggleMm = (city: string, name: string) =>
    setF((x) => ({
      ...x,
      microMarkets: x.microMarkets.some((m) => m.city === city && m.name === name) ? x.microMarkets.filter((m) => !(m.city === city && m.name === name)) : [...x.microMarkets, { city, name }],
    }));
  const mmList = locations.find((c) => c.name === mmCity)?.microMarkets ?? [];

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="panel">
        <div className="pb row-flex" style={{ gap: 18 }}>
          <Avatar name={profile.fullName} fileId={profile.avatarFileId} size={84} ring={ring.pct} />
          <div className="grow stack" style={{ gap: 4 }}>
            <div className="row-flex">
              <h2 style={{ margin: 0 }}>{profile.fullName}</h2>
              <LevelChip level={level.key} name={level.name} />
            </div>
            <span className="muted">
              @{profile.username} · Member since {fmtDate(profile.memberSince)} · Profile {ring.pct}% complete
            </span>
            {ring.next && <span className="small">Next: {ring.next}</span>}
            <div className="row-flex">
              <Button className="small" onClick={() => fileRef.current?.click()} loading={upBusy}>
                {profile.avatarFileId ? 'Change photo' : 'Upload photo'}
              </Button>
              {profile.avatarFileId && (
                <button
                  className="btn small ghost"
                  onClick={async () => {
                    await api('/api/broker/profile/avatar', { method: 'DELETE' }).catch(() => null);
                    router.refresh();
                  }}
                >
                  Remove
                </button>
              )}
              <span className="hint">JPG or PNG up to 5 MB</span>
              <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png" onChange={(e) => (pickFile(e.target.files?.[0]), (e.target.value = ''))} />
            </div>
          </div>
        </div>
      </div>

      <section className="form-sec">
        <h3>Username</h3>
        <div className="grid">
          <Field
            label="Username"
            hint={profile.nextUsernameChange ? `You can change it again on ${fmtDate(profile.nextUsernameChange)}.` : 'Can be changed once every 30 days.'}
            error={uState.s === 'invalid' ? '4 to 20 characters: lowercase letters, numbers, dot and underscore' : uState.s === 'taken' ? 'Taken' : undefined}
          >
            <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} maxLength={20} disabled={Boolean(profile.nextUsernameChange)} />
          </Field>
          <div className="f" style={{ justifyContent: 'flex-end' }}>
            <span className="row-flex">
              {uState.s === 'ok' && <span className="okmsg">✓ Available</span>}
              <Button className="small" onClick={saveUsername} loading={uBusy} disabled={uState.s !== 'ok'}>
                Change username
              </Button>
            </span>
          </div>
          {uState.s === 'taken' && uState.sug.length > 0 && (
            <div className="full row-flex small">
              <span className="muted">Try:</span>
              {uState.sug.map((s) => (
                <button key={s} className="chip" style={{ border: 0, cursor: 'pointer' }} onClick={() => setUsername(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="form-sec">
        <h3>Details</h3>
        <div className="grid">
          <Field label="Full name" error={fields.fullName}>
            <input value={f.fullName} onChange={(e) => setF((x) => ({ ...x, fullName: e.target.value }))} />
          </Field>
          <Field label="Company name" error={fields.company}>
            <input value={f.company} onChange={(e) => setF((x) => ({ ...x, company: e.target.value }))} />
          </Field>
          <Field label="City based in" error={fields.city}>
            <select value={f.city} onChange={(e) => setF((x) => ({ ...x, city: e.target.value }))}>
              {locations.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Alternate phone" error={fields.altPhone}>
            <input type="tel" value={f.altPhone} onChange={(e) => setF((x) => ({ ...x, altPhone: e.target.value }))} />
          </Field>
          <div className="full f">
            <span className="lab">Micro markets you cover</span>
            <span className="hint">Helps Abacus know whom to ask. New requirement emails go to brokers who cover that city.</span>
            <div className="row-flex">
              <select className="input" style={{ width: 'auto' }} value={mmCity} onChange={(e) => setMmCity(e.target.value)} aria-label="City for micro markets">
                {locations.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="chips" style={{ marginTop: 6 }}>
              {mmList.length === 0 && <span className="muted">No micro markets listed for {mmCity} yet.</span>}
              {mmList.map((m) => {
                const on = f.microMarkets.some((x) => x.city === mmCity && x.name === m.name);
                return (
                  <label key={m.name} className={`choice ${on ? 'on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleMm(mmCity, m.name)} />
                    {m.name}
                  </label>
                );
              })}
            </div>
            {f.microMarkets.length > 0 && (
              <span className="small" style={{ marginTop: 6 }}>
                Selected: {f.microMarkets.map((m) => `${m.name} (${m.city})`).join(', ')}
              </span>
            )}
          </div>
          <div className="full">
            <Button className="primary" onClick={save} loading={saving}>
              Save details
            </Button>
          </div>
        </div>
      </section>

      <section className="form-sec">
        <h3>Phone and email</h3>
        <div className="grid">
          <div className="f">
            <span className="lab">Primary phone (WhatsApp)</span>
            <ContactChange kind="phone" current={profile.phone} verified={profile.phoneVerified} whatsapp={whatsapp} />
          </div>
          <div className="f">
            <span className="lab">Email</span>
            <ContactChange kind="email" current={profile.email} verified={profile.emailVerified} whatsapp={whatsapp} />
          </div>
        </div>
      </section>

      <section className="form-sec">
        <h3>Password</h3>
        <div className="grid">
          <Field label="Current password" error={pwFields.current}>
            <PasswordInput autoComplete="current-password" value={pw.current} onChange={(e) => setPw((x) => ({ ...x, current: e.target.value }))} />
          </Field>
          <span />
          <Field label="New password" hint="At least 8 characters with a number" error={pwFields.password}>
            <PasswordInput autoComplete="new-password" value={pw.password} onChange={(e) => setPw((x) => ({ ...x, password: e.target.value }))} />
          </Field>
          <Field label="Confirm new password" error={pwFields.confirmPassword}>
            <PasswordInput autoComplete="new-password" value={pw.confirmPassword} onChange={(e) => setPw((x) => ({ ...x, confirmPassword: e.target.value }))} />
          </Field>
          <div className="full">
            <Button onClick={changePw} loading={pwBusy} disabled={!pw.current || !pw.password}>
              Change password
            </Button>
          </div>
        </div>
      </section>

      {crop && <AvatarCropper file={crop} onCancel={() => setCrop(null)} onDone={upload} />}
    </div>
  );
}
