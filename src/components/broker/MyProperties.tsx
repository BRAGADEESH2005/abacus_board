'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiErr } from '@/components/ui/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ListingBadge, StageBadge } from '@/components/ui/Badges';
import { evaluateMatch } from '@/lib/domain';
import { ago, fmtDate, inr, num, rentRange, sqft } from '@/lib/format';
import type { BrokerProperty } from '@/lib/services/brokerData';
import type { PublicRequirement } from '@/lib/services/publicReq';

const FILTERS = [
  { k: 'all', label: 'All' },
  { k: 'active', label: 'Active' },
  { k: 'matched', label: 'Matched by Abacus' },
  { k: 'reconfirm', label: 'Need reconfirming' },
  { k: 'drafts', label: 'Drafts' },
  { k: 'closed', label: 'Let out or withdrawn' },
];

function SuggestModal({ p, reqs, suggested, onClose }: { p: BrokerProperty; reqs: PublicRequirement[]; suggested: Set<string>; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const ranked = useMemo(
    () =>
      reqs
        .filter((r) => !suggested.has(`${p.id}|${r.id}`))
        .map((r) => {
          const m = evaluateMatch(r, { city: p.city, microMarket: p.microMarket, stretch: p.stretch, format: p.format, carpetArea: p.carpetArea, floorCount: p.floorCount, ceilingHeight: p.ceilingHeight, powerKva: p.powerKva, frontage: p.frontage, rent: p.rent });
          const near = r.city === p.city && p.carpetArea !== null && p.carpetArea >= r.carpetMin && p.carpetArea <= r.carpetMax;
          return { r, fit: m.fits, near, score: m.score + (near ? 5 : 0) + (r.city === p.city ? 5 : 0) };
        })
        .sort((a, b) => b.score - a.score),
    [reqs, p, suggested],
  );
  const go = async () => {
    setBusy(true);
    try {
      await api('/api/broker/suggestions', { body: { pairs: picked.map((id) => ({ propertyId: p.id, requirementId: id })), note } });
      toast(`Suggested ${p.code} for ${picked.length} requirement${picked.length === 1 ? '' : 's'}`, 'success');
      onClose();
      router.refresh();
    } catch (e) {
      toast((e as ApiErr).message, 'error');
    }
    setBusy(false);
  };
  return (
    <Modal
      title={`Suggest ${p.code} for a requirement`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <Button className="primary" onClick={go} loading={busy} disabled={!picked.length}>
            Suggest
          </Button>
        </>
      }
    >
      <p className="small" style={{ margin: 0 }}>Open requirements, best fit first. Abacus decides every match.</p>
      {ranked.length === 0 && <div className="muted">No open requirements left to suggest this for.</div>}
      {ranked.map(({ r, fit, near }) => (
        <label key={r.id} className={`opt ${fit || near ? 'fit' : ''}`}>
          <input type="checkbox" checked={picked.includes(r.id)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, r.id] : x.filter((y) => y !== r.id)))} />
          <span className="grow">
            <span className="code">{r.code}</span> {fit ? <span className="pill p-won">Fits</span> : near ? <span className="pill p-match">Near fit</span> : null}
            <div>
              <b>
                {r.microMarket}, {r.city}
              </b>{' '}
              <span className="muted">· {r.sector}</span>
            </div>
            <div className="small muted">
              {sqft(r.carpetMin, r.carpetMax)} · {rentRange(r.rentBandMin, r.rentBandMax)}
            </div>
          </span>
        </label>
      ))}
      <label className="f">
        One line note (optional)
        <input maxLength={160} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
    </Modal>
  );
}

function PropertyCard({ p, reqs, suggested }: { p: BrokerProperty; reqs: PublicRequirement[]; suggested: Set<string> }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [suggest, setSuggest] = useState(false);
  const draft = p.state === 'draft';

  const listing = async (action: string) => {
    setBusy(true);
    try {
      await api(`/api/broker/properties/${p.id}/listing`, { body: { action } });
      toast(action === 'reconfirm' ? 'Thanks. Listing confirmed for another 30 days.' : 'Listing updated', 'success');
      router.refresh();
    } catch (e) {
      toast((e as ApiErr).message, 'error');
    }
    setBusy(false);
  };
  const remove = async () => {
    if (!confirm(`Delete draft ${p.code}? The code will not be reused.`)) return;
    try {
      await api(`/api/broker/properties/${p.id}`, { method: 'DELETE' });
      toast('Draft deleted');
      router.refresh();
    } catch (e) {
      toast((e as ApiErr).message, 'error');
    }
  };

  return (
    <div className="prop">
      <div className="top">
        <span className="code big">{p.code}</span>
        <ListingBadge status={p.listingStatus} draft={draft} />
        <span className="ago">{draft ? `Started ${ago(p.createdAt)}` : `Uploaded ${ago(p.submittedAt)}`}</span>
      </div>
      <h3>{[p.buildingName, p.microMarket, p.city].filter(Boolean).join(', ')}</h3>
      <div className="chips">
        <span className="chip">
          <b>{num(p.carpetArea)}</b> sq ft
        </span>
        <span className="chip">
          Frontage <b>{p.frontage ?? '—'} ft</b>
        </span>
        <span className="chip">
          <b>{inr(p.rent)}</b>/sq ft
        </span>
        <span className="chip">{p.availableDate ? `From ${fmtDate(p.availableDate)}` : p.condition || 'Status not set'}</span>
        {p.driveLink ? (
          <a className="chip" href={p.driveLink} target="_blank" rel="noreferrer">
            Photos and videos ↗
          </a>
        ) : (
          <span className="chip warn">No Drive link</span>
        )}
      </div>
      <div className="row-flex">
        {draft ? (
          <>
            <Link className="btn small primary" href={`/broker/properties/${p.id}/edit`}>
              Continue draft
            </Link>
            <button className="btn small ghost" onClick={remove}>
              Delete draft
            </button>
          </>
        ) : (
          <>
            <select
              className="input"
              style={{ width: 'auto', padding: '5px 8px', fontSize: 13 }}
              value={p.listingStatus === 'needs_reconfirm' ? 'available' : p.listingStatus}
              onChange={(e) => listing(e.target.value)}
              disabled={busy}
              aria-label="Listing status"
            >
              <option value="available">Available</option>
              <option value="let_out">Let out</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
            {p.listingStatus === 'needs_reconfirm' && (
              <Button className="small primary" onClick={() => listing('reconfirm')} loading={busy}>
                Still available
              </Button>
            )}
            {p.listingStatus === 'available' && (
              <button className="btn small" onClick={() => setSuggest(true)}>
                Suggest for a requirement
              </button>
            )}
            <Link className="btn small ghost" href={`/broker/properties/${p.id}/edit`}>
              Edit
            </Link>
          </>
        )}
      </div>
      {!draft && (
        <div className="foot">
          <span className="muted">Abacus stage:</span>
          <StageBadge stage={p.stage} />
          {p.stage === 'Not closed' && p.stageNote && <span className="small">{p.stageNote}</span>}
          {p.listingStatus === 'needs_reconfirm' && <span className="small" style={{ color: 'var(--maroon)' }}>Not confirmed for 30 days, so it is out of matching until you tap Still available.</span>}
        </div>
      )}
      {suggest && <SuggestModal p={p} reqs={reqs} suggested={suggested} onClose={() => setSuggest(false)} />}
    </div>
  );
}

export function MyProperties({ properties, requirements, suggested, initialFilter }: { properties: BrokerProperty[]; requirements: PublicRequirement[]; suggested: string[]; initialFilter: string }) {
  const [filter, setFilter] = useState(FILTERS.some((f) => f.k === initialFilter) ? initialFilter : 'all');
  const sug = useMemo(() => new Set(suggested), [suggested]);
  const list = properties.filter((p) => {
    switch (filter) {
      case 'active':
        return p.state === 'submitted' && p.listingStatus === 'available';
      case 'matched':
        return p.state !== 'draft' && p.matched;
      case 'reconfirm':
        return p.state === 'submitted' && p.listingStatus === 'needs_reconfirm';
      case 'drafts':
        return p.state === 'draft';
      case 'closed':
        return p.state !== 'draft' && ['let_out', 'withdrawn'].includes(p.listingStatus);
      default:
        return true;
    }
  });
  return (
    <>
      <div className="pagehead">
        <div>
          <h1>My properties</h1>
          <p className="lead">Only you and Abacus can see these. Confirm each listing is still available at least every 30 days.</p>
        </div>
        <Link className="btn primary" href="/broker/properties/new">
          Post a property
        </Link>
      </div>
      <div className="ptabs">
        {FILTERS.map((f) => (
          <button key={f.k} aria-pressed={filter === f.k} onClick={() => setFilter(f.k)}>
            {f.label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <b>{properties.length ? 'Nothing in this list' : 'No properties yet'}</b>
          {properties.length ? 'Try another filter.' : 'Post your first property and Abacus will start matching it.'}
          {!properties.length && (
            <div style={{ marginTop: 12 }}>
              <Link className="btn primary" href="/broker/properties/new">
                Post a property
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="list">
          {list.map((p) => (
            <PropertyCard key={p.id} p={p} reqs={requirements} suggested={sug} />
          ))}
        </div>
      )}
    </>
  );
}
