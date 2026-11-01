'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiErr } from '@/components/ui/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

export type RankedReq = { id: string; code: string; brand: string; place: string; fits: boolean; tags: string[]; failed: string[]; pitched: boolean };

/** From a property: every active requirement in every city, best fits first. Tick one or more, click Pitch. */
export function PitchToRequirement({ propertyId, code, options, disabledReason }: { propertyId: string; code: string; options: RankedReq[]; disabledReason?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? options : options.filter((o) => o.fits || o.pitched).concat(options.filter((o) => !o.fits && !o.pitched).slice(0, 5));

  const go = async () => {
    setBusy(true);
    try {
      const r = await api<{ created: string[] }>('/api/admin/pitches', { body: { pairs: picked.map((id) => ({ propertyId, requirementId: id })), note } });
      toast(`Pitched to ${r.created.length} requirement${r.created.length === 1 ? '' : 's'}`, 'success');
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
    <>
      <button className="btn primary small" onClick={() => setOpen(true)} disabled={Boolean(disabledReason)} title={disabledReason}>
        Pitch to requirement
      </button>
      {open && (
        <Modal
          title={`Pitch ${code}`}
          wide
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <Button className="primary" onClick={go} loading={busy} disabled={!picked.length}>
                Pitch {picked.length ? `to ${picked.length}` : ''}
              </Button>
            </>
          }
        >
          {options.length === 0 && <div className="muted">No open requirements.</div>}
          {shown.map((o) => (
            <label key={o.id} className={`opt ${o.fits ? 'fit' : ''}`} style={o.pitched ? { opacity: 0.6 } : undefined}>
              <input type="checkbox" disabled={o.pitched} checked={picked.includes(o.id)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, o.id] : x.filter((y) => y !== o.id)))} />
              <span className="grow">
                <b>{o.brand}</b> <span className="code">{o.code}</span> {o.pitched ? <span className="pill p-prop">Already pitched</span> : o.fits ? <span className="pill p-won">Fits</span> : null}
                {o.tags.map((t) => (
                  <span key={t} className="pill p-match" style={{ marginLeft: 4 }}>
                    {t}
                  </span>
                ))}
                <div className="small">{o.place}</div>
                {!o.fits && o.failed.length > 0 && <div className="small" style={{ color: 'var(--maroon)' }}>Misses: {o.failed.join(', ')}</div>}
              </span>
            </label>
          ))}
          {!showAll && options.length > shown.length && (
            <button className="linkbtn small" onClick={() => setShowAll(true)}>
              Show all {options.length} open requirements
            </button>
          )}
          <label className="f">
            Note (optional, kept with the pitch)
            <input maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </Modal>
      )}
    </>
  );
}
