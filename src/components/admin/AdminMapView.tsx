'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BoardMap, type MapCircle, type MapProp } from '@/components/map';
import { FORMATS, PROPERTY_STAGES } from '@/lib/constants';
import { inr, num } from '@/lib/format';
import type { PropView } from '@/lib/services/adminView';
import { PropertyStageSelect } from './actions';
import { StageBadge } from '@/components/ui/Badges';

export const STAGE_COLOR: Record<string, string> = {
  Received: '#8A8984',
  'Under review': '#C99A2E',
  Shortlisted: '#9A6408',
  Pitched: '#B5474A',
  'Site visit done': '#7F1416',
  'Under negotiation': '#4A0B0C',
  Closed: '#2F6B3F',
  'Not closed': '#BDB8B3',
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function AdminMapView({ props, circles, brokers }: { props: PropView[]; circles: { key: string; city: string; microMarket: string; lat: number; lng: number; radius: number; brands: number }[]; brokers: { id: string; label: string }[] }) {
  const [city, setCity] = useState('');
  const [broker, setBroker] = useState('');
  const [stage, setStage] = useState('');
  const [format, setFormat] = useState('');
  const [amin, setAmin] = useState('');
  const [amax, setAmax] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const cities = useMemo(() => [...new Set([...props.map((p) => p.city), ...circles.map((c) => c.city)])].sort(), [props, circles]);

  const shown = props.filter(
    (p) =>
      (!city || p.city === city) &&
      (!broker || p.brokerId === broker) &&
      (!stage || p.stage === stage) &&
      (!format || p.format === format) &&
      (!amin || (p.carpetArea ?? 0) >= Number(amin)) &&
      (!amax || (p.carpetArea ?? 0) <= Number(amax)),
  );
  const shownCircles = circles.filter((c) => !city || c.city === city);
  const mapProps: MapProp[] = useMemo(
    () =>
      shown.map((p) => ({
        id: p.id,
        code: p.code,
        lat: p.lat!,
        lng: p.lng!,
        color: STAGE_COLOR[p.stage] ?? '#7F1416',
        popup: `<div style="font:13px/1.45 'IBM Plex Sans',sans-serif;min-width:200px"><b style="font-family:monospace">${esc(p.code)}</b><br>${esc(p.brokerName)}<br>${num(p.carpetArea)} sq ft · ${inr(p.rent)}/sq ft<br>Stage: <b>${esc(p.stage)}</b><br>${p.driveLink ? `<a href="${esc(p.driveLink)}" target="_blank" rel="noreferrer">Photos</a> · ` : ''}<a href="/admin/properties/${p.id}">Open property</a>${p.notes ? `<div style="margin-top:4px;color:#5E5F5A;max-height:80px;overflow:auto">${esc(p.notes.slice(0, 300))}</div>` : ''}</div>`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown.map((p) => p.id + p.stage).join()],
  );
  const mapCircles: MapCircle[] = useMemo(() => shownCircles.map((c) => ({ key: c.key, lat: c.lat, lng: c.lng, radius: c.radius, label: `${c.microMarket} · ${c.brands} brand${c.brands === 1 ? '' : 's'}` })), [shownCircles]);
  const sel = shown.find((p) => p.id === selected);

  return (
    <>
      <div className="row-flex" style={{ marginBottom: 10 }}>
        <select className="input" style={{ width: 'auto' }} value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="input" style={{ width: 'auto' }} value={broker} onChange={(e) => setBroker(e.target.value)} aria-label="Broker">
          <option value="">All brokers</option>
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
        <select className="input" style={{ width: 'auto' }} value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Stage">
          <option value="">Any stage</option>
          {PROPERTY_STAGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="input" style={{ width: 'auto' }} value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Format">
          <option value="">Any format</option>
          {FORMATS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input className="input" style={{ width: 110 }} type="number" placeholder="Min sq ft" value={amin} onChange={(e) => setAmin(e.target.value)} />
        <input className="input" style={{ width: 110 }} type="number" placeholder="Max sq ft" value={amax} onChange={(e) => setAmax(e.target.value)} />
      </div>
      <div className="legend-dots" style={{ marginBottom: 10 }}>
        {PROPERTY_STAGES.map((s) => (
          <span key={s}>
            <i style={{ background: STAGE_COLOR[s] }} />
            {s}
          </span>
        ))}
        <span>
          <i style={{ background: 'rgba(127,20,22,.2)', border: '1px solid #7F1416' }} />
          Micro market with open requirements
        </span>
      </div>
      <div className="mapwrap">
        <BoardMap props={mapProps} circles={mapCircles} onSelect={setSelected} selected={selected} />
        <div className="mapside panel">
          {sel && (
            <div className="pb" style={{ borderBottom: '1px solid var(--line)', background: 'var(--maroon-soft)' }}>
              <div className="spread">
                <span className="code big">{sel.code}</span>
                <button className="btn tiny ghost" onClick={() => setSelected(null)}>
                  ✕
                </button>
              </div>
              <div className="small">
                {sel.brokerName} · {sel.microMarket}, {sel.city}
              </div>
              <div className="small">
                {num(sel.carpetArea)} sq ft · {inr(sel.rent)}/sq ft · {sel.format}
              </div>
              <div className="row-flex" style={{ marginTop: 6 }}>
                <PropertyStageSelect propertyId={sel.id} stage={sel.stage} pitches={sel.pitches} />
                {sel.driveLink && (
                  <a className="btn tiny" href={sel.driveLink} target="_blank" rel="noreferrer">
                    Photos ↗
                  </a>
                )}
                <Link className="btn tiny primary" href={`/admin/properties/${sel.id}`}>
                  Open property
                </Link>
              </div>
              {sel.notes && <p className="small" style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{sel.notes}</p>}
            </div>
          )}
          <div className="ph">
            <h3>{shown.length} properties on screen</h3>
          </div>
          {shown.length === 0 && <div className="pb muted">No properties match these filters.</div>}
          {shown.map((p) => (
            <button key={p.id} className="nitem" style={{ width: '100%', border: 0, borderBottom: '1px solid var(--line)', background: p.id === selected ? 'var(--sunk)' : 'transparent', textAlign: 'left', cursor: 'pointer' }} onClick={() => setSelected(p.id)}>
              <span className="ic" style={{ background: STAGE_COLOR[p.stage] }} />
              <span className="grow">
                <b className="mono">{p.code}</b>
                <span className="small">
                  {p.microMarket}, {p.city} · {num(p.carpetArea)} sq ft · {p.brokerName}
                </span>
              </span>
              <StageBadge stage={p.stage} />
            </button>
          ))}
          {shownCircles.length > 0 && (
            <>
              <div className="ph">
                <h3>Demand areas</h3>
              </div>
              {shownCircles.map((c) => (
                <div key={c.key} className="nitem">
                  <span className="ic" style={{ background: 'rgba(127,20,22,.3)' }} />
                  <span className="grow small">
                    <b>{c.microMarket}</b> {c.city} · {c.brands} brand{c.brands === 1 ? '' : 's'} ·{' '}
                    {props.filter((p) => p.city === c.city && p.microMarket === c.microMarket).length} properties posted
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
