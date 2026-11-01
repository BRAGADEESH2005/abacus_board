'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiErr } from '@/components/ui/api';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { ago } from '@/lib/format';
import type { LocationList } from '@/lib/settings';

export function StartProperty({ locations, defaultCity, defaultMm, suggestFor, drafts }: { locations: LocationList; defaultCity: string; defaultMm: string; suggestFor: string; drafts: { id: string; code: string; place: string; updatedAt: string }[] }) {
  const router = useRouter();
  const [city, setCity] = useState(locations.some((c) => c.name === defaultCity) ? defaultCity : (locations[0]?.name ?? ''));
  const [mm, setMm] = useState(defaultMm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const c = locations.find((x) => x.name === city);

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ id: string }>('/api/broker/properties', { body: { city, microMarket: mm } });
      router.push(`/broker/properties/${r.id}/edit${suggestFor ? `?suggestFor=${suggestFor}` : ''}`);
    } catch (e) {
      setError((e as ApiErr).message);
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <section className="form-sec">
        <h3>Start a new property</h3>
        <div className="grid">
          <Field label="City" req>
            <select value={city} onChange={(e) => (setCity(e.target.value), setMm(''))}>
              {locations.map((l) => (
                <option key={l.name}>{l.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Micro market" hint="You can change this in the form">
            <select value={mm} onChange={(e) => setMm(e.target.value)}>
              <option value="">Choose later</option>
              {c?.microMarkets.map((m) => (
                <option key={m.name}>{m.name}</option>
              ))}
            </select>
          </Field>
          <div className="full row-flex">
            <Button className="primary" onClick={start} loading={busy} disabled={!city}>
              Reserve a code and start
            </Button>
            {error && <span className="err">{error}</span>}
          </div>
        </div>
      </section>
      {drafts.length > 0 && (
        <div className="panel">
          <div className="ph">
            <h3>Or continue a draft</h3>
          </div>
          <div className="pb">
            {drafts.map((d) => (
              <div className="rowline" key={d.id}>
                <span className="code big">{d.code}</span>
                <span>{d.place}</span>
                <span className="muted">edited {ago(d.updatedAt)}</span>
                <Link className="btn small right" href={`/broker/properties/${d.id}/edit${suggestFor ? `?suggestFor=${suggestFor}` : ''}`}>
                  Continue
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
