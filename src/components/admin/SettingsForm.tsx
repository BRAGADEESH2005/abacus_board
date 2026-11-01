'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiErr } from '@/components/ui/api';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

type S = {
  weeklyTarget: number;
  sopLink: string;
  sopIntro: string;
  sopShots: string;
  sopFolders: string;
  sopShare: string;
  notesHelp: string;
  measureVideoUrl: string;
  levels: { key: string; name: string; threshold: number }[];
};

const LEVEL_RULE: Record<string, string> = {
  scout: 'Signed up with codes verified (no threshold)',
  pro: 'Complete properties with a map pin and floor plan',
  partner: 'Properties matched (pitched) by Abacus',
  elite: 'Deals closed through the board',
};

export function SettingsForm({ initial }: { initial: S }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = (k: keyof S, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true);
    setFields({});
    try {
      await api('/api/admin/settings', { method: 'PUT', body: f });
      toast('Settings saved', 'success');
      router.refresh();
    } catch (e) {
      const err = e as ApiErr;
      setFields(err.fields ?? {});
      toast(err.message, 'error');
    }
    setBusy(false);
  };
  return (
    <div className="stack">
      <section className="form-sec">
        <h3>Weekly target and broker levels</h3>
        <div className="grid">
          <Field label="Weekly target: new brands posting requirements" error={fields.weeklyTarget} hint="Monday to Sunday, India time">
            <input type="number" min={1} value={f.weeklyTarget} onChange={(e) => set('weeklyTarget', Number(e.target.value))} />
          </Field>
          <span />
          {f.levels.map((l, i) => (
            <div key={l.key} className="full pair" style={{ gridTemplateColumns: '1fr 140px 2fr', alignItems: 'end' }}>
              <Field label={`Level ${i + 1} name`}>
                <input value={l.name} onChange={(e) => set('levels', f.levels.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
              </Field>
              <Field label="Threshold">
                <input type="number" min={0} value={l.threshold} disabled={l.key === 'scout'} onChange={(e) => set('levels', f.levels.map((x, k) => (k === i ? { ...x, threshold: Number(e.target.value) } : x)))} />
              </Field>
              <span className="hint" style={{ paddingBottom: 10 }}>{LEVEL_RULE[l.key]}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="form-sec">
        <h3>Post a Property: help text brokers see</h3>
        <div className="grid">
          <Field label="Photo and video SOP PDF link" error={fields.sopLink} hint="A Google Drive link to the SOP PDF. Shown inside the pop up.">
            <input value={f.sopLink} onChange={(e) => set('sopLink', e.target.value)} placeholder="https://drive.google.com/file/d/…" />
          </Field>
          <Field label="How to measure video link (C7)" error={fields.measureVideoUrl} hint="The 40 second animation. Leave blank to hide the link.">
            <input value={f.measureVideoUrl} onChange={(e) => set('measureVideoUrl', e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="SOP tab 1 intro" className="full">
            <textarea rows={2} value={f.sopIntro} onChange={(e) => set('sopIntro', e.target.value)} />
          </Field>
          <Field label="SOP tab 1 shot list" className="full" hint="One shot per line as: Shot description | Photo (or Video)">
            <textarea rows={8} value={f.sopShots} onChange={(e) => set('sopShots', e.target.value)} />
          </Field>
          <Field label="SOP tab 2 subfolders" hint="One per line. The main folder is named with the property code and locality automatically.">
            <textarea rows={8} value={f.sopFolders} onChange={(e) => set('sopFolders', e.target.value)} />
          </Field>
          <Field label="SOP tab 3 sharing steps" hint="One step per line. PRP CHN 0042 is replaced with the broker's real code.">
            <textarea rows={8} value={f.sopShare} onChange={(e) => set('sopShare', e.target.value)} />
          </Field>
          <Field label="Additional notes pop up (H2)" className="full" hint="One point per line. Text before a colon is shown in bold.">
            <textarea rows={6} value={f.notesHelp} onChange={(e) => set('notesHelp', e.target.value)} />
          </Field>
          <div className="full">
            <Button className="primary" onClick={save} loading={busy}>
              Save settings
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
