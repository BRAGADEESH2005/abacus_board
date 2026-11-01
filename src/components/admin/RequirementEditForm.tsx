'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiErr } from '@/components/ui/api';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { CONDITION_ACCEPTED, FORMATS, PREFERRED_FLOORS } from '@/lib/constants';
import type { LocationList } from '@/lib/settings';

type Ov = { stretch: string; carpetMin: number; carpetMax: number; rentMin: number; rentMax: number };
type Init = {
  status: 'open' | 'on_hold' | 'closed';
  city: string;
  microMarket: string;
  stretches: string[];
  storesWanted: number;
  carpetMin: number;
  carpetMax: number;
  rentMin: number;
  rentMax: number;
  overrides: Ov[];
  formats: string[];
  floors: string[];
  minFrontage: number | null;
  minCeiling: number | null;
  minPowerKva: number | null;
  conditionAccepted: string;
  parkingCars: number | null;
  parkingBikes: number | null;
  signage: string;
  otherSpecs: string;
  maxDepositMonths: number | null;
  leaseYears: number | null;
  lockInYears: number | null;
  priority: 'normal' | 'high';
  receivedOn: string;
  internalNotes: string;
};

const s = (n: number | null) => (n === null || n === undefined ? '' : String(n));

/** Edit one micro market requirement: values, location row, status (open, on hold, closed). */
export function RequirementEditForm({ id, initial, locations }: { id: string; initial: Init; locations: LocationList }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState(() => ({
    ...initial,
    minFrontage: s(initial.minFrontage),
    minCeiling: s(initial.minCeiling),
    minPowerKva: s(initial.minPowerKva),
    parkingCars: s(initial.parkingCars),
    parkingBikes: s(initial.parkingBikes),
    maxDepositMonths: s(initial.maxDepositMonths),
    leaseYears: s(initial.leaseYears),
    lockInYears: s(initial.lockInYears),
    storesWanted: String(initial.storesWanted),
    carpetMin: String(initial.carpetMin),
    carpetMax: String(initial.carpetMax),
    rentMin: String(initial.rentMin),
    rentMax: String(initial.rentMax),
  }));
  const [fields, setFields] = useState<Record<string, string>>({});
  const stretchList = locations.find((c) => c.name === initial.city)?.microMarkets.find((m) => m.name === initial.microMarket)?.stretches ?? [];
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (k: 'formats' | 'floors' | 'stretches', v: string) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));

  const quickStatus = async (status: Init['status']) => {
    setBusy(true);
    await save(status);
  };

  const save = async (status = f.status) => {
    setBusy(true);
    setFields({});
    const values = {
      formats: f.formats,
      carpetMin: f.carpetMin,
      carpetMax: f.carpetMax,
      rentMin: f.rentMin,
      rentMax: f.rentMax,
      minFrontage: f.minFrontage,
      floors: f.floors,
      minCeiling: f.minCeiling,
      minPowerKva: f.minPowerKva,
      conditionAccepted: f.conditionAccepted,
      parkingCars: f.parkingCars,
      parkingBikes: f.parkingBikes,
      signage: f.signage,
      otherSpecs: f.otherSpecs,
      maxDepositMonths: f.maxDepositMonths,
      leaseYears: f.leaseYears,
      lockInYears: f.lockInYears,
      priority: f.priority,
      receivedOn: f.receivedOn,
      internalNotes: f.internalNotes,
    };
    const row = {
      city: f.city,
      microMarket: f.microMarket,
      stretches: f.stretches,
      storesWanted: f.storesWanted,
      carpetMin: f.carpetMin,
      carpetMax: f.carpetMax,
      rentMin: f.rentMin,
      rentMax: f.rentMax,
      overrides: f.overrides.filter((o) => f.stretches.includes(o.stretch)),
    };
    try {
      await api(`/api/admin/requirements/${id}`, { method: 'PATCH', body: { values, row, status } });
      toast('Requirement updated', 'success');
      setOpen(false);
      router.refresh();
    } catch (e) {
      const err = e as ApiErr;
      setFields(err.fields ?? {});
      toast(err.message, 'error');
    }
    setBusy(false);
  };

  return (
    <div className="row-flex">
      {initial.status === 'open' ? (
        <>
          <Button className="small" onClick={() => quickStatus('on_hold')} loading={busy}>
            Put on hold
          </Button>
          <Button className="small" onClick={() => confirm('Close this requirement? It disappears from the broker board.') && quickStatus('closed')} loading={busy}>
            Close
          </Button>
        </>
      ) : (
        <Button className="small" onClick={() => quickStatus('open')} loading={busy}>
          Reopen
        </Button>
      )}
      <button className="btn small primary" onClick={() => setOpen(true)}>
        Edit
      </button>
      {open && (
        <Modal
          title="Edit requirement"
          wide
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <Button className="primary" onClick={() => save()} loading={busy}>
                Save
              </Button>
            </>
          }
        >
          {Object.keys(fields).length > 0 && <div className="notice">{Object.values(fields)[0]}</div>}
          <div className="grid" style={{ padding: 0 }}>
            <Field label="Status">
              <select value={f.status} onChange={(e) => set('status', e.target.value)}>
                <option value="open">Open</option>
                <option value="on_hold">On hold</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
            <Field label="Priority">
              <select value={f.priority} onChange={(e) => set('priority', e.target.value)}>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </Field>
            <Field label="Stores wanted">
              <input type="number" min={1} value={f.storesWanted} onChange={(e) => set('storesWanted', e.target.value)} />
            </Field>
            <span />
            <Field label="Carpet min (sq ft)">
              <input type="number" value={f.carpetMin} onChange={(e) => set('carpetMin', e.target.value)} />
            </Field>
            <Field label="Carpet max (sq ft)">
              <input type="number" value={f.carpetMax} onChange={(e) => set('carpetMax', e.target.value)} />
            </Field>
            <Field label="Rent min (₹/sq ft, exact)">
              <input type="number" value={f.rentMin} onChange={(e) => set('rentMin', e.target.value)} />
            </Field>
            <Field label="Rent max (₹/sq ft, exact)" hint="Realtors see a band, recalculated on save">
              <input type="number" value={f.rentMax} onChange={(e) => set('rentMax', e.target.value)} />
            </Field>
            <div className="full f">
              <span className="lab">Stretches (none ticked = anywhere in {initial.microMarket})</span>
              <div className="chips">
                {stretchList.map((x) => (
                  <label key={x} className={`choice ${f.stretches.includes(x) ? 'on' : ''}`}>
                    <input type="checkbox" checked={f.stretches.includes(x)} onChange={() => toggle('stretches', x)} />
                    {x}
                  </label>
                ))}
                {!stretchList.length && <span className="muted">No stretches listed for this micro market.</span>}
              </div>
            </div>
            <div className="full f">
              <span className="lab">Format</span>
              <div className="chips">
                {FORMATS.map((x) => (
                  <label key={x} className={`choice ${f.formats.includes(x) ? 'on' : ''}`}>
                    <input type="checkbox" checked={f.formats.includes(x)} onChange={() => toggle('formats', x)} />
                    {x}
                  </label>
                ))}
              </div>
            </div>
            <div className="full f">
              <span className="lab">Preferred floors</span>
              <div className="chips">
                {PREFERRED_FLOORS.map((x) => (
                  <label key={x} className={`choice ${f.floors.includes(x) ? 'on' : ''}`}>
                    <input type="checkbox" checked={f.floors.includes(x)} onChange={() => toggle('floors', x)} />
                    {x}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Min frontage (ft)">
              <input type="number" value={f.minFrontage} onChange={(e) => set('minFrontage', e.target.value)} />
            </Field>
            <Field label="Min ceiling (ft)">
              <input type="number" value={f.minCeiling} onChange={(e) => set('minCeiling', e.target.value)} />
            </Field>
            <Field label="Min power (kVA)">
              <input type="number" value={f.minPowerKva} onChange={(e) => set('minPowerKva', e.target.value)} />
            </Field>
            <Field label="Condition accepted">
              <select value={f.conditionAccepted} onChange={(e) => set('conditionAccepted', e.target.value)}>
                <option value="">Not set</option>
                {CONDITION_ACCEPTED.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Parking cars">
              <input type="number" value={f.parkingCars} onChange={(e) => set('parkingCars', e.target.value)} />
            </Field>
            <Field label="Parking two wheelers">
              <input type="number" value={f.parkingBikes} onChange={(e) => set('parkingBikes', e.target.value)} />
            </Field>
            <Field label="Max deposit (months)">
              <input type="number" value={f.maxDepositMonths} onChange={(e) => set('maxDepositMonths', e.target.value)} />
            </Field>
            <Field label="Lease (years)">
              <input type="number" value={f.leaseYears} onChange={(e) => set('leaseYears', e.target.value)} />
            </Field>
            <Field label="Lock in (years)">
              <input type="number" value={f.lockInYears} onChange={(e) => set('lockInYears', e.target.value)} />
            </Field>
            <Field label="Received on">
              <input type="date" value={f.receivedOn} onChange={(e) => set('receivedOn', e.target.value)} />
            </Field>
            <Field label="Signage" className="full">
              <input value={f.signage} onChange={(e) => set('signage', e.target.value)} />
            </Field>
            <Field label="Other specifications (realtors see)" className="full">
              <textarea value={f.otherSpecs} onChange={(e) => set('otherSpecs', e.target.value)} />
            </Field>
            <Field label="Internal notes (admin only)" className="full">
              <textarea value={f.internalNotes} onChange={(e) => set('internalNotes', e.target.value)} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
