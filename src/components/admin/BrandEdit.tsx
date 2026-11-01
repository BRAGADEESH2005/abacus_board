'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiErr } from '@/components/ui/api';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { FEE_OPTIONS, SECTORS, STORE_MODELS } from '@/lib/constants';

type B = { id: string; name: string; sector: string; contactName: string; designation: string; phone: string; email: string; storeModel: string; fee: number; paysNothing: boolean; notes: string };

export function BrandEdit({ brand }: { brand: B }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ ...brand, fee: String(brand.fee) });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/admin/brands/${brand.id}`, { method: 'PATCH', body: { ...f, fee: Number(f.fee) } });
      toast('Brand saved', 'success');
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast((e as ApiErr).message, 'error');
    }
    setBusy(false);
  };
  return (
    <>
      <button className="btn small" onClick={() => setOpen(true)}>
        Edit brand
      </button>
      {open && (
        <Modal
          title={`Edit ${brand.name}`}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <Button className="primary" onClick={save} loading={busy}>
                Save
              </Button>
            </>
          }
        >
          <div className="grid" style={{ padding: 0 }}>
            <Field label="Brand name">
              <input value={f.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Sector">
              <select value={f.sector} onChange={(e) => set('sector', e.target.value)}>
                {SECTORS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Contact name">
              <input value={f.contactName} onChange={(e) => set('contactName', e.target.value)} />
            </Field>
            <Field label="Designation">
              <input value={f.designation} onChange={(e) => set('designation', e.target.value)} />
            </Field>
            <Field label="Phone">
              <input value={f.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Email">
              <input value={f.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Store model">
              <select value={f.storeModel} onChange={(e) => set('storeModel', e.target.value)}>
                <option value="">Not set</option>
                {STORE_MODELS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Our fee">
              <select value={f.fee} onChange={(e) => set('fee', e.target.value)}>
                {FEE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <label className="full row-flex small">
              <input type="checkbox" checked={f.paysNothing} onChange={(e) => set('paysNothing', e.target.checked)} style={{ accentColor: 'var(--maroon)' }} />
              Brand pays nothing (realtors see a commission sharing notice on every requirement)
            </label>
            <Field label="Notes (admin only)" className="full">
              <textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}
