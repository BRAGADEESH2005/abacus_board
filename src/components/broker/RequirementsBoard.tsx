'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { api, ApiErr } from '@/components/ui/api';
import { useToast } from '@/components/ui/Toast';
import { SECTORS } from '@/lib/constants';
import { ago, rentRange, sqft } from '@/lib/format';
import type { PublicRequirement } from '@/lib/services/publicReq';

const AREAS = [
  { k: '', label: 'Any carpet area', min: 0, max: Infinity },
  { k: 's', label: 'Under 1,000 sq ft', min: 0, max: 999 },
  { k: 'm', label: '1,000 to 2,000 sq ft', min: 1000, max: 2000 },
  { k: 'l', label: '2,000 to 5,000 sq ft', min: 2000, max: 5000 },
  { k: 'xl', label: '5,000 sq ft and above', min: 5000, max: Infinity },
];

export function SaveButton({ id, saved, onChange }: { id: string; saved: boolean; onChange: (v: boolean) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="save"
      aria-pressed={saved}
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        try {
          await api(`/api/broker/requirements/${id}/save`, { body: { saved: !saved } });
          onChange(!saved);
        } catch (err) {
          toast((err as ApiErr).message, 'error');
        }
        setBusy(false);
      }}
    >
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}

export function RequirementCard({ r, saved, onSaved }: { r: PublicRequirement; saved: boolean; onSaved: (v: boolean) => void }) {
  return (
    <Link href={`/broker/requirements/${r.id}`} className="card click">
      <div className="top">
        <span className="code">{r.code}</span>
        {r.priority === 'high' && <span className="prio">Priority</span>}
        <span className="ago">{ago(r.postedAt)}</span>
        <SaveButton id={r.id} saved={saved} onChange={onSaved} />
      </div>
      <h3>
        {r.microMarket}, {r.city}
      </h3>
      <dl className="syn">
        <dt>Stretch</dt>
        <dd>{r.stretches.length ? r.stretches.join(', ') : 'Anywhere in this micro market'}</dd>
        <dt>Sector</dt>
        <dd>{r.sector}</dd>
        <dt>Carpet area</dt>
        <dd>{sqft(r.carpetMin, r.carpetMax)}</dd>
        <dt>Rent</dt>
        <dd>{rentRange(r.rentBandMin, r.rentBandMax)}</dd>
        <dt>Frontage, floor</dt>
        <dd>
          {r.minFrontage ? `${r.minFrontage} ft+` : 'Any frontage'} · {r.floors.length ? r.floors.join(', ') : 'Any floor'}
        </dd>
      </dl>
    </Link>
  );
}

export function RequirementsBoard({
  requirements,
  demand,
  saved: savedInit,
  myCities,
  initial,
}: {
  requirements: PublicRequirement[];
  demand: { city: string; state: string; microMarket: string; brands: number }[];
  saved: string[];
  myCities: string[];
  initial: { city: string; mm: string; saved: boolean; mine: boolean };
}) {
  const [saved, setSaved] = useState(new Set(savedInit));
  const [state, setState] = useState('');
  const [city, setCity] = useState(initial.city);
  const [mm, setMm] = useState(initial.mm);
  const [sector, setSector] = useState('');
  const [area, setArea] = useState('');
  const [savedOnly, setSavedOnly] = useState(initial.saved);
  const [mine, setMine] = useState(initial.mine);
  const [demandMine, setDemandMine] = useState(false);

  const states = useMemo(() => [...new Set(requirements.map((r) => r.state))].sort(), [requirements]);
  const cities = useMemo(() => [...new Set(requirements.filter((r) => !state || r.state === state).map((r) => r.city))].sort(), [requirements, state]);
  const a = AREAS.find((x) => x.k === area)!;

  const list = requirements.filter(
    (r) =>
      (!state || r.state === state) &&
      (!city || r.city === city) &&
      (!mm || r.microMarket === mm) &&
      (!sector || r.sector === sector) &&
      (!mine || myCities.includes(r.city)) &&
      (!savedOnly || saved.has(r.id)) &&
      r.carpetMax >= a.min &&
      r.carpetMin <= a.max,
  );
  const shownDemand = demand.filter((d) => !demandMine || myCities.includes(d.city));

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Requirements</h1>
          <p className="lead">Where Abacus needs retail space. Brand names stay with Abacus; post a fitting property and suggest it.</p>
        </div>
      </div>

      {demand.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <div className="spread" style={{ marginBottom: 8 }}>
            <h3>Demand by micro market</h3>
            <label className="row-flex small" style={{ gap: 6 }}>
              <input type="checkbox" checked={demandMine} onChange={(e) => setDemandMine(e.target.checked)} style={{ accentColor: 'var(--maroon)' }} />
              Only my cities
            </label>
          </div>
          <div className="demand">
            {shownDemand.map((d) => (
              <button
                key={`${d.city}|${d.microMarket}`}
                className={city === d.city && mm === d.microMarket ? 'on' : ''}
                onClick={() => {
                  if (city === d.city && mm === d.microMarket) {
                    setMm('');
                  } else {
                    setState('');
                    setCity(d.city);
                    setMm(d.microMarket);
                  }
                }}
              >
                <b>{d.microMarket}</b>
                <span>
                  {d.city} · {d.brands} brand{d.brands === 1 ? '' : 's'} looking
                </span>
              </button>
            ))}
            {shownDemand.length === 0 && <span className="muted">No open requirements in your cities right now.</span>}
          </div>
        </section>
      )}

      <div className="filters row-flex" style={{ marginBottom: 12 }}>
        <select className="input" style={{ width: 'auto' }} value={state} onChange={(e) => (setState(e.target.value), setCity(''), setMm(''))} aria-label="State">
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="input" style={{ width: 'auto' }} value={city} onChange={(e) => (setCity(e.target.value), setMm(''))} aria-label="City">
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="input" style={{ width: 'auto' }} value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector">
          <option value="">All sectors</option>
          {SECTORS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="input" style={{ width: 'auto' }} value={area} onChange={(e) => setArea(e.target.value)} aria-label="Carpet area">
          {AREAS.map((x) => (
            <option key={x.k} value={x.k}>
              {x.label}
            </option>
          ))}
        </select>
        <label className="row-flex small" style={{ gap: 6 }}>
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} style={{ accentColor: 'var(--maroon)' }} /> In my cities
        </label>
        <label className="row-flex small" style={{ gap: 6 }}>
          <input type="checkbox" checked={savedOnly} onChange={(e) => setSavedOnly(e.target.checked)} style={{ accentColor: 'var(--maroon)' }} /> Saved only
        </label>
        {mm && (
          <button className="chip" style={{ border: 0, cursor: 'pointer' }} onClick={() => setMm('')}>
            {mm} ✕
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <b>No requirements match these filters</b>
          {requirements.length ? 'Clear a filter to see more.' : 'Abacus has no open requirements right now.'}
        </div>
      ) : (
        <div className="cards">
          {list.map((r) => (
            <RequirementCard
              key={r.id}
              r={r}
              saved={saved.has(r.id)}
              onSaved={(v) =>
                setSaved((s) => {
                  const n = new Set(s);
                  if (v) n.add(r.id);
                  else n.delete(r.id);
                  return n;
                })
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
