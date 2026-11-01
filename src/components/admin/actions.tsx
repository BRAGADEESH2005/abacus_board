'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiErr } from '@/components/ui/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { PITCH_STAGES, PROPERTY_STAGES } from '@/lib/constants';
import { stageClass } from '@/lib/domain';

function useAct() {
  const router = useRouter();
  const toast = useToast();
  return async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn();
      if (success) toast(success, 'success');
      router.refresh();
      return true;
    } catch (e) {
      toast((e as ApiErr).message, 'error');
      return false;
    }
  };
}

function NoteModal({ title, onSave, onClose, placeholder }: { title: string; onSave: (note: string) => Promise<void>; onClose: () => void; placeholder: string }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <Button
            className="primary"
            loading={busy}
            disabled={!note.trim()}
            onClick={async () => {
              setBusy(true);
              await onSave(note.trim());
              setBusy(false);
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <label className="f">
        Short note (the broker sees this)
        <input autoFocus maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder={placeholder} />
      </label>
    </Modal>
  );
}

/** One click stage on a property card, map card or pending list (Admin v2, section 6). */
export function PropertyStageSelect({ propertyId, stage, pitches }: { propertyId: string; stage: string; pitches: { id: string; code: string; brand: string; stage: string }[] }) {
  const act = useAct();
  const [pending, setPending] = useState<string | null>(null);
  const [needNote, setNeedNote] = useState(false);
  const [pickPitch, setPickPitch] = useState(false);

  const send = async (s: string, note = '', pitchId?: string) => {
    const ok = await act(() => api(`/api/admin/properties/${propertyId}/stage`, { method: 'PATCH', body: { stage: s, note, pitchId } }), `Stage set to ${s}`);
    if (ok) {
      setPending(null);
      setNeedNote(false);
      setPickPitch(false);
    }
  };

  const choose = (s: string) => {
    if (s === stage) return;
    setPending(s);
    if (s === 'Not closed') return setNeedNote(true);
    if (['Site visit done', 'Under negotiation', 'Closed'].includes(s) && pitches.length > 1) return setPickPitch(true);
    send(s);
  };

  return (
    <>
      <select className={`input stage-select ${stageClass(stage)}`} style={{ width: 'auto', padding: '4px 8px', fontSize: 13, fontWeight: 600 }} value={stage} onChange={(e) => choose(e.target.value)} aria-label="Property stage">
        {PROPERTY_STAGES.map((s) => (
          <option key={s} value={s} disabled={s === 'Pitched' && stage !== 'Pitched'}>
            {s}
            {s === 'Pitched' ? ' (automatic)' : ''}
          </option>
        ))}
      </select>
      {needNote && <NoteModal title="Not closed: why?" placeholder="Property shortage, Rent too high…" onClose={() => setNeedNote(false)} onSave={(n) => send('Not closed', n)} />}
      {pickPitch && pending && (
        <Modal title={`Which pitch moved to ${pending}?`} onClose={() => setPickPitch(false)}>
          {pitches.map((p) => (
            <button key={p.id} className="opt" style={{ textAlign: 'left', background: 'var(--surface)' }} onClick={() => send(pending, '', p.id)}>
              <span className="grow">
                <b>{p.brand}</b> <span className="code">{p.code}</span>
                <div className="small muted">Now: {p.stage}</div>
              </span>
            </button>
          ))}
        </Modal>
      )}
    </>
  );
}

export function PitchStageSelect({ pitchId, stage }: { pitchId: string; stage: string }) {
  const act = useAct();
  const [needNote, setNeedNote] = useState(false);
  const send = (s: string, note = '') => act(() => api(`/api/admin/pitches/${pitchId}`, { method: 'PATCH', body: { stage: s, note } }), `Pitch moved to ${s}`);
  return (
    <>
      <select
        className={`input ${stageClass(stage)}`}
        style={{ width: 'auto', padding: '4px 8px', fontSize: 13, fontWeight: 600 }}
        value={stage}
        onChange={(e) => (e.target.value === 'Not closed' ? setNeedNote(true) : send(e.target.value))}
        aria-label="Pitch stage"
      >
        {PITCH_STAGES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      {needNote && (
        <NoteModal
          title="Not closed: why?"
          placeholder="Rent too high, brand chose another site…"
          onClose={() => setNeedNote(false)}
          onSave={async (n) => {
            if (await send('Not closed', n)) setNeedNote(false);
          }}
        />
      )}
    </>
  );
}

export function PitchButton({ pairs, label = 'Pitch', className = 'small primary', note }: { pairs: { propertyId: string; requirementId: string }[]; label?: string; className?: string; note?: string }) {
  const act = useAct();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      className={className}
      loading={busy}
      disabled={!pairs.length}
      onClick={async () => {
        setBusy(true);
        await act(() => api('/api/admin/pitches', { body: { pairs, note: note ?? '' } }), pairs.length === 1 ? 'Pitched' : `Pitched ${pairs.length}`);
        setBusy(false);
      }}
    >
      {label}
    </Button>
  );
}

export function DismissButton({ propertyId, requirementId, label = 'Dismiss' }: { propertyId: string; requirementId: string; label?: string }) {
  const act = useAct();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      className="small"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await act(() => api('/api/admin/dismiss', { body: { propertyId, requirementId } }), 'Dismissed');
        setBusy(false);
      }}
    >
      {label}
    </Button>
  );
}

export function StillActiveButton({ requirementId }: { requirementId: string }) {
  const act = useAct();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      className="small"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await act(() => api(`/api/admin/requirements/${requirementId}/still-active`, { method: 'POST' }), 'Marked still active');
        setBusy(false);
      }}
    >
      Still active
    </Button>
  );
}

export function ReviewButton({ propertyId }: { propertyId: string }) {
  const act = useAct();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      className="small primary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        if (await act(() => api(`/api/admin/properties/${propertyId}/stage`, { method: 'PATCH', body: { stage: 'Under review' } }))) router.push(`/admin/properties/${propertyId}`);
        setBusy(false);
      }}
    >
      Review
    </Button>
  );
}

export function DuplicateButtons({ pairId }: { pairId: string }) {
  const act = useAct();
  const [busy, setBusy] = useState<string | null>(null);
  const go = async (action: 'merge' | 'keep') => {
    if (action === 'merge' && !confirm('Merge keeps the earlier upload and retires the later one. Continue?')) return;
    setBusy(action);
    await act(() => api(`/api/admin/duplicates/${pairId}`, { body: { action } }), action === 'merge' ? 'Merged' : 'Kept both');
    setBusy(null);
  };
  return (
    <span className="row-flex">
      <Button className="small" loading={busy === 'merge'} onClick={() => go('merge')}>
        Merge
      </Button>
      <Button className="small" loading={busy === 'keep'} onClick={() => go('keep')}>
        Keep both
      </Button>
    </span>
  );
}

export function UndoPitchButton({ pitchId }: { pitchId: string }) {
  const act = useAct();
  return (
    <button
      className="linkbtn small"
      onClick={() => {
        if (confirm('Undo this pitch? Only do this if it was logged by mistake.')) act(() => api(`/api/admin/pitches/${pitchId}`, { method: 'DELETE' }), 'Pitch undone');
      }}
    >
      Undo
    </button>
  );
}

export function CitySelect({ cities, value, param = 'city' }: { cities: string[]; value: string; param?: string }) {
  const router = useRouter();
  return (
    <select
      className="input"
      style={{ width: 'auto' }}
      value={value}
      aria-label="City filter"
      onChange={(e) => {
        const u = new URL(window.location.href);
        if (e.target.value) u.searchParams.set(param, e.target.value);
        else u.searchParams.delete(param);
        router.push(u.pathname + u.search);
      }}
    >
      <option value="">All cities</option>
      {cities.map((c) => (
        <option key={c}>{c}</option>
      ))}
    </select>
  );
}
