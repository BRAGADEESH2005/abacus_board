'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiErr } from '@/components/ui/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { whatsappText } from '@/lib/domain';
import { fmtDate, inr, num, rentRange, sqft } from '@/lib/format';
import type { PublicRequirement } from '@/lib/services/publicReq';
import { SaveButton } from './RequirementsBoard';

type Pick = { id: string; code: string; place: string; carpet: number | null; rent: number | null; fit: boolean };
type Sug = { id: string; propertyId: string; code: string; note: string; createdAt: string; response: string };

const v = (x: unknown, suffix = '') => (x === null || x === undefined || x === '' ? '—' : `${x}${suffix}`);

export function RequirementDetail({ r, saved: savedInit, picker, suggestions, url }: { r: PublicRequirement; saved: boolean; picker: Pick[]; suggestions: Sug[]; url: string }) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState(savedInit);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const already = new Set(suggestions.map((s) => s.propertyId));
  const options = picker.filter((p) => !already.has(p.id));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(whatsappText(r, url));
      toast('Copied. Paste it into WhatsApp.', 'success');
    } catch {
      toast('Could not copy on this browser.', 'error');
    }
  };

  const suggest = async () => {
    setBusy(true);
    try {
      const res = await api<{ created: string[] }>('/api/broker/suggestions', { body: { pairs: picked.map((id) => ({ propertyId: id, requirementId: r.id })), note } });
      toast(`Suggested ${res.created.length} propert${res.created.length === 1 ? 'y' : 'ies'}`, 'success');
      setOpen(false);
      setPicked([]);
      setNote('');
      router.refresh();
    } catch (e) {
      toast((e as ApiErr).message, 'error');
    }
    setBusy(false);
  };

  return (
    <div className="detail">
      <div className="dh">
        <div className="top">
          <span className="code">{r.code}</span>
          {r.priority === 'high' && <span className="prio">Priority</span>}
          <span className="pill l-avail">Open</span>
          <span className="ago">Posted {fmtDate(r.postedAt)}</span>
        </div>
        <h1>
          {r.microMarket}, {r.city}
        </h1>
        <span className="muted">{r.sector}</span>
      </div>
      {r.paysNothingNotice && (
        <div className="notice" style={{ margin: '14px 20px 0' }}>
          <b>Brand pays no commission.</b> Commission sharing applies before you pitch for this requirement. The terms are in your partnership agreement with Abacus.
        </div>
      )}
      <div className="blocks" style={{ marginTop: r.paysNothingNotice ? 14 : 0 }}>
        <div className="block">
          <h4>Location</h4>
          <dl>
            <dt>City</dt>
            <dd>{r.city}</dd>
            <dt>Micro market</dt>
            <dd>{r.microMarket}</dd>
            <dt>Stretches</dt>
            <dd>{r.stretches.length ? r.stretches.join(', ') : 'Anywhere in this micro market'}</dd>
            <dt>Format</dt>
            <dd>{r.formats.join(', ') || 'Any'}</dd>
          </dl>
        </div>
        <div className="block">
          <h4>Commercials</h4>
          <dl>
            <dt>Rent</dt>
            <dd>{rentRange(r.rentBandMin, r.rentBandMax)} per month</dd>
            <dt>Max deposit</dt>
            <dd>{v(r.maxDepositMonths, ' months')}</dd>
            <dt>Lease term</dt>
            <dd>{v(r.leaseYears, ' years')}</dd>
            <dt>Lock in</dt>
            <dd>{v(r.lockInYears, ' years')}</dd>
          </dl>
        </div>
        <div className="block">
          <h4>Space</h4>
          <dl>
            <dt>Carpet area</dt>
            <dd>{sqft(r.carpetMin, r.carpetMax)}</dd>
            {r.stretchCarpet.map((s) => (
              <span key={s.stretch} style={{ display: 'contents' }}>
                <dt>On {s.stretch}</dt>
                <dd>{sqft(s.carpetMin, s.carpetMax)}</dd>
              </span>
            ))}
            <dt>Floor</dt>
            <dd>{r.floors.join(', ') || 'Any'}</dd>
            <dt>Min frontage</dt>
            <dd>{v(r.minFrontage, ' ft')}</dd>
            <dt>Min ceiling</dt>
            <dd>{v(r.minCeiling, ' ft')}</dd>
            <dt>Min power</dt>
            <dd>{v(r.minPowerKva, ' kVA')}</dd>
            <dt>Condition</dt>
            <dd>{v(r.conditionAccepted)}</dd>
            <dt>Parking</dt>
            <dd>{r.parkingCars || r.parkingBikes ? `${num(r.parkingCars ?? 0)} cars, ${num(r.parkingBikes ?? 0)} two wheelers` : '—'}</dd>
            <dt>Signage</dt>
            <dd>{v(r.signage)}</dd>
          </dl>
        </div>
        <div className="block">
          <h4>Other</h4>
          <p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>{r.otherSpecs || 'No other specifications.'}</p>
        </div>
      </div>
      <div className="acts">
        <SaveButton id={r.id} saved={saved} onChange={setSaved} />
        <button className="btn primary small" onClick={() => setOpen(true)}>
          Suggest a property
        </button>
        <Link className="btn small" href={`/broker/properties/new?city=${encodeURIComponent(r.city)}&mm=${encodeURIComponent(r.microMarket)}&suggestFor=${r.id}`}>
          Upload a new property
        </Link>
        <button className="btn small" onClick={copy}>
          Copy for WhatsApp
        </button>
      </div>
      <div style={{ padding: '14px 20px' }}>
        <h3 style={{ marginBottom: 6 }}>Your suggestions for this requirement</h3>
        {suggestions.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>None yet. Other brokers&apos; suggestions are never shown.</p>
        ) : (
          suggestions.map((s) => (
            <div className="rowline" key={s.id}>
              <span className="code big">{s.code}</span>
              <span className="muted">{fmtDate(s.createdAt)}</span>
              {s.note && <span className="small">“{s.note}”</span>}
              <span className={`pill ${s.response === 'Taken forward' ? 'p-won' : s.response === 'Not taken forward' ? 'p-no' : 'p-wait'} right`}>{s.response}</span>
            </div>
          ))
        )}
      </div>

      {open && (
        <Modal
          title={`Suggest for ${r.code}`}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <Button className="primary" onClick={suggest} loading={busy} disabled={!picked.length}>
                Suggest {picked.length || ''}
              </Button>
            </>
          }
        >
          <p className="small" style={{ margin: 0 }}>
            Your active listings, nearest match first. A suggestion is a hint; Abacus decides every match.
          </p>
          {options.length === 0 ? (
            <div className="empty">
              <b>No active listings to suggest</b>
              <Link href={`/broker/properties/new?city=${encodeURIComponent(r.city)}&mm=${encodeURIComponent(r.microMarket)}&suggestFor=${r.id}`}>Upload a new property</Link>
            </div>
          ) : (
            options.map((p) => (
              <label key={p.id} className={`opt ${p.fit ? 'fit' : ''}`}>
                <input type="checkbox" checked={picked.includes(p.id)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, p.id] : x.filter((y) => y !== p.id)))} />
                <span className="grow">
                  <span className="code big">{p.code}</span> {p.fit && <span className="pill p-match">Good fit</span>}
                  <div className="small">
                    {p.place} · {num(p.carpet)} sq ft · {inr(p.rent)}/sq ft
                  </div>
                </span>
              </label>
            ))
          )}
          <label className="f">
            One line note (optional)
            <input maxLength={160} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Corner unit, landlord flexible on rent" />
          </label>
        </Modal>
      )}
    </div>
  );
}
