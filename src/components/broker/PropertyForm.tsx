'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiErr } from '@/components/ui/api';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { LocationMap } from '@/components/map';
import { FloorPlanHelper, type FloorPlanValue } from './FloorPlanHelper';
import { NotesHelpModal, SopModal, type SopTexts } from './SopModal';
import {
  CONDITIONS_NEEDING_DATE,
  DEALT_WITH,
  DRIVE_FOLDER_PREFIX,
  FLOOR_COUNTS,
  FORMATS,
  NOTES_MAX,
  PARKING_TYPES,
  PROPERTY_CONDITIONS,
  TOILET_OPTIONS,
  floorsFor,
  type FloorCount,
} from '@/lib/constants';
import { coordsFromMapsUrl, hasFloorPlanInput, missingRequired } from '@/lib/domain';
import { num } from '@/lib/format';
import type { BrokerProperty } from '@/lib/services/brokerData';
import type { LocationList } from '@/lib/settings';

type YN = '' | 'yes' | 'no';
const yn = (v: boolean | null | undefined): YN => (v === true ? 'yes' : v === false ? 'no' : '');
const ynBool = (v: YN) => (v === 'yes' ? true : v === 'no' ? false : null);
const n = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

function initial(p: BrokerProperty) {
  return {
    propertyType: p.propertyType,
    city: p.city,
    microMarket: p.microMarket,
    stretch: p.stretch,
    format: p.format,
    address: p.address,
    buildingName: p.buildingName,
    mainRoad: p.mainRoad,
    lat: p.lat,
    lng: p.lng,
    pinLink: p.pinLink,
    chargeableArea: n(p.chargeableArea),
    carpetArea: n(p.carpetArea),
    floorCount: p.floorCount,
    floorAreas: (p.floorAreas ?? []).map((x) => (x ? String(x) : '')),
    sameLayout: p.sameLayout,
    ceilingHeight: n(p.ceilingHeight),
    frontage: n(p.frontage),
    floorPlan: (p.floorPlan as FloorPlanValue) ?? null,
    floorPlanLink: p.floorPlanLink,
    rent: n(p.rent),
    depositMonths: n(p.depositMonths),
    maintenance: n(p.maintenance),
    escalation: p.escalation,
    landlordName: p.landlordName,
    dealtWith: p.dealtWith,
    commissionConfirmed: yn(p.commissionConfirmed),
    commissionDays: n(p.commissionDays),
    powerKva: n(p.powerKva),
    powerBackup: yn(p.powerBackup),
    lift: yn(p.lift),
    bikeSlots: n(p.bikeSlots),
    bikeType: p.bikeType,
    carSlots: n(p.carSlots),
    carType: p.carType,
    toilets: p.toilets,
    signageSpace: yn(p.signageSpace),
    septicBelow: yn(p.septicBelow),
    windows: yn(p.windows),
    electricalBoards: yn(p.electricalBoards),
    condition: p.condition,
    availableDate: p.availableDate,
    driveLink: p.driveLink,
    notes: p.notes,
  };
}
type F = ReturnType<typeof initial>;

function toPayload(f: F) {
  return {
    ...f,
    floorAreas: f.floorAreas.map((x) => Number(x) || 0),
    powerBackup: f.powerBackup,
    lift: f.lift,
    signageSpace: f.signageSpace,
    septicBelow: f.septicBelow,
    windows: f.windows,
    electricalBoards: f.electricalBoards,
  };
}

function YesNo({ value, onChange, name }: { value: YN; onChange: (v: YN) => void; name: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={name}>
      <button type="button" aria-pressed={value === 'yes'} onClick={() => onChange('yes')}>
        Yes
      </button>
      <button type="button" aria-pressed={value === 'no'} onClick={() => onChange('no')}>
        No
      </button>
    </div>
  );
}

const SECTIONS = [
  { id: 'A', title: 'Basics' },
  { id: 'B', title: 'Location' },
  { id: 'C', title: 'Area and floors' },
  { id: 'D', title: 'Commercials and landlord' },
  { id: 'E', title: 'Building and services' },
  { id: 'F', title: 'Inside the premises' },
  { id: 'G', title: 'Status' },
  { id: 'H', title: 'Photos and video' },
];

type Nearby = { id: string; code: string; place: string; sector: string };

export function PropertyForm({
  property,
  locations,
  texts,
  measureVideoUrl,
  drawVideoUrl,
  suggestFor,
}: {
  property: BrokerProperty;
  locations: LocationList;
  texts: SopTexts;
  measureVideoUrl: string;
  drawVideoUrl?: string;
  suggestFor?: { id: string; code: string } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<F>(() => initial(property));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitTried, setSubmitTried] = useState(false);
  const [done, setDone] = useState<{ code: string; nearby: Nearby[] } | null>(null);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [sop, setSop] = useState(false);
  const [notesHelp, setNotesHelp] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState('');
  const submitted = property.state === 'submitted';
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback(<K extends keyof F>(k: K, v: F[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setDirty(true);
  }, []);

  const city = locations.find((c) => c.name === f.city);
  const mm = city?.microMarkets.find((m) => m.name === f.microMarket);
  const floors = floorsFor(f.floorCount as FloorCount);
  const center = useMemo(
    () => (mm?.lat != null && mm?.lng != null ? { lat: mm.lat, lng: mm.lng } : city?.lat != null && city?.lng != null ? { lat: city.lat, lng: city.lng } : { lat: 13.0827, lng: 80.2707 }),
    [mm?.lat, mm?.lng, city?.lat, city?.lng],
  );

  // Floors changed: keep values for floors that still exist and drop the rest (Broker v2, section 5).
  useEffect(() => {
    setF((x) => (x.floorAreas.length === floors.length ? x : { ...x, floorAreas: floors.map((_, i) => x.floorAreas[i] ?? '') }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.floorCount]);

  const payload = useMemo(() => toPayload(f), [f]);
  const missing = useMemo(
    () =>
      missingRequired({
        ...payload,
        chargeableArea: Number(f.chargeableArea) || null,
        carpetArea: Number(f.carpetArea) || null,
        ceilingHeight: Number(f.ceilingHeight) || null,
        frontage: Number(f.frontage) || null,
        rent: Number(f.rent) || null,
        depositMonths: f.depositMonths === '' ? null : Number(f.depositMonths),
        powerKva: f.powerKva === '' ? null : Number(f.powerKva),
        bikeSlots: f.bikeSlots === '' ? null : Number(f.bikeSlots),
        carSlots: f.carSlots === '' ? null : Number(f.carSlots),
        powerBackup: ynBool(f.powerBackup),
        lift: ynBool(f.lift),
        signageSpace: ynBool(f.signageSpace),
        septicBelow: ynBool(f.septicBelow),
        windows: ynBool(f.windows),
        electricalBoards: ynBool(f.electricalBoards),
        driveLink: f.driveLink.startsWith(DRIVE_FOLDER_PREFIX) ? f.driveLink : '',
      } as never),
    [payload, f],
  );
  const totalRequired = useMemo(() => missingRequired({ floorCount: f.floorCount, condition: f.condition } as never).length, [f.floorCount, f.condition]);
  const pct = Math.round(((totalRequired - Math.min(totalRequired, missing.length)) / totalRequired) * 100);

  const save = useCallback(
    async (quiet = false) => {
      setSaving(true);
      try {
        const r = await api<{ savedAt: string }>(`/api/broker/properties/${property.id}`, { method: 'PATCH', body: payload });
        setSavedAt(r.savedAt);
        setDirty(false);
        setFields({});
        if (!quiet) toast(submitted ? 'Changes saved' : 'Draft saved', 'success');
        return true;
      } catch (e) {
        const err = e as ApiErr;
        setFields(err.fields ?? {});
        if (!quiet || err.status !== 422) toast(err.message, 'error');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [payload, property.id, submitted, toast],
  );

  // Drafts save themselves a moment after each change, so the broker can finish later.
  useEffect(() => {
    if (!dirty || submitted) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(true), 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dirty, payload, save, submitted]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const usePinLink = async () => {
    setPinError('');
    const local = coordsFromMapsUrl(f.pinLink);
    if (local) {
      setF((x) => ({ ...x, lat: local.lat, lng: local.lng }));
      setDirty(true);
      return;
    }
    setPinBusy(true);
    try {
      const r = await api<{ lat: number; lng: number }>(`/api/geo/resolve?url=${encodeURIComponent(f.pinLink)}`);
      setF((x) => ({ ...x, lat: r.lat, lng: r.lng }));
      setDirty(true);
    } catch (e) {
      setPinError((e as ApiErr).message);
    } finally {
      setPinBusy(false);
    }
  };

  const submit = async () => {
    setSubmitTried(true);
    if (!hasFloorPlanInput(f)) document.getElementById('c7')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (missing.length) {
      toast(`Still to fill: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? ` and ${missing.length - 4} more` : ''}`, 'error');
      return;
    }
    setSubmitting(true);
    const okSave = await save(true);
    if (!okSave) {
      setSubmitting(false);
      toast('Fix the highlighted fields first', 'error');
      return;
    }
    if (submitted) {
      setSubmitting(false);
      toast('Changes saved', 'success');
      router.push('/broker/properties');
      router.refresh();
      return;
    }
    try {
      const r = await api<{ code: string; nearby: Nearby[] }>(`/api/broker/properties/${property.id}/submit`, { method: 'POST' });
      setDone(r);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      router.refresh();
    } catch (e) {
      toast((e as ApiErr).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const suggest = async (reqId: string, code: string) => {
    try {
      await api('/api/broker/suggestions', { body: { pairs: [{ propertyId: property.id, requirementId: reqId }] } });
      setSuggested((s) => [...s, reqId]);
      toast(`Suggested ${property.code} for ${code}`, 'success');
    } catch (e) {
      toast((e as ApiErr).message, 'error');
    }
  };

  if (done) {
    const extra = suggestFor && !done.nearby.some((x) => x.id === suggestFor.id) ? [{ id: suggestFor.id, code: suggestFor.code, place: 'The requirement you came from', sector: '' }] : [];
    const list = [...extra, ...done.nearby];
    return (
      <div className="stack">
        <div className="notice green">
          <b>{done.code}</b> is posted. Abacus will review it and match it to requirements. Name your Drive folder with this code.
        </div>
        {list.length > 0 && (
          <div className="panel">
            <div className="ph">
              <h3>Open requirements this property may fit</h3>
            </div>
            <div className="pb">
              {list.map((r) => (
                <div className="rowline" key={r.id}>
                  <span className="code">{r.code}</span>
                  <b>{r.place}</b>
                  {r.sector && <span className="muted">{r.sector}</span>}
                  <span className="right">
                    {suggested.includes(r.id) ? (
                      <span className="okmsg">✓ Suggested</span>
                    ) : (
                      <button className="btn small primary" onClick={() => suggest(r.id, r.code)}>
                        {suggestFor?.id === r.id ? `Suggest this for ${r.code}` : 'Suggest'}
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="row-flex">
          <Link className="btn primary" href="/broker/properties">
            Go to my properties
          </Link>
          <Link className="btn" href="/broker/properties/new">
            Post another property
          </Link>
        </div>
      </div>
    );
  }

  const err = (k: string) => fields[k];
  const numIn = (k: keyof F, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input type="number" inputMode="decimal" min={0} step="any" value={f[k] as string} onChange={(e) => set(k, e.target.value as never)} {...props} />
  );
  const floorSum = f.floorAreas.reduce((s, x) => s + (Number(x) || 0), 0);
  const carpet = Number(f.carpetArea) || 0;

  return (
    <div>
      <div className="formbar">
        <div className="spread" style={{ marginBottom: 8 }}>
          <span className="row-flex">
            <span className="codebox">{property.code}</span>
            <span className="muted">
              {submitted ? 'Posted · editing' : 'Draft'} · {pct}% of required fields
              {saving ? ' · saving…' : savedAt ? ' · saved' : ''}
            </span>
          </span>
          <span className="row-flex">
            {!submitted && (
              <Button className="small" onClick={() => save(false)} loading={saving}>
                Save draft
              </Button>
            )}
            <Button className="small primary" onClick={submit} loading={submitting}>
              {submitted ? 'Save changes' : 'Post property'}
            </Button>
          </span>
        </div>
        <div className="progress" aria-label={`${pct}% complete`}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="steps" style={{ marginTop: 8 }}>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#sec-${s.id}`}>
              {s.id} {s.title}
            </a>
          ))}
        </div>
      </div>

      <section className="form-sec" id="sec-A">
        <h3>A. Basics</h3>
        <div className="grid">
          <Field label="A1 City" req error={err('city')}>
            <select value={f.city} onChange={(e) => (set('city', e.target.value), set('microMarket', ''), set('stretch', ''))} disabled={submitted}>
              {locations.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="A2 Micro market" req error={err('microMarket')} hint={city && !city.microMarkets.length ? 'No micro markets listed for this city yet. Ask Abacus to add yours.' : undefined}>
            <select value={f.microMarket} onChange={(e) => (set('microMarket', e.target.value), set('stretch', ''))} disabled={!city}>
              <option value="">Choose</option>
              {city?.microMarkets.map((m) => (
                <option key={m.name}>{m.name}</option>
              ))}
            </select>
          </Field>
          {mm && mm.stretches.length > 0 && (
            <Field label="Stretch (if it sits on one)" hint="Helps Abacus match requirements that name a stretch">
              <select value={f.stretch} onChange={(e) => set('stretch', e.target.value)}>
                <option value="">Not on a listed stretch</option>
                {mm.stretches.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="A3 Format" req error={err('format')}>
            <select value={f.format} onChange={(e) => set('format', e.target.value as F['format'])}>
              <option value="">Choose</option>
              {FORMATS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="A4 Address and landmark" req className="full" error={err('address')}>
            <input value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Door number, street, near…" />
          </Field>
          <Field label="Building name">
            <input value={f.buildingName} onChange={(e) => set('buildingName', e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Main road">
            <input value={f.mainRoad} onChange={(e) => set('mainRoad', e.target.value)} placeholder="Mount Poonamallee Road" />
          </Field>
        </div>
      </section>

      <section className="form-sec" id="sec-B">
        <h3>B. Location</h3>
        <div className="grid">
          <Field group label="B1 Paste a Google Maps pin link" hint="Or tap the building on the map below. Either way the coordinates are saved." className="full" error={pinError}>
            <div className="row-flex">
              <input aria-label="Google Maps pin link" className="input grow" value={f.pinLink} onChange={(e) => set('pinLink', e.target.value)} placeholder="https://maps.app.goo.gl/…" />
              <Button type="button" className="small" onClick={usePinLink} loading={pinBusy} disabled={!f.pinLink.trim()}>
                Read pin
              </Button>
            </div>
          </Field>
          <div className="full">
            <LocationMap
              center={center}
              value={f.lat != null && f.lng != null ? { lat: f.lat, lng: f.lng } : null}
              onChange={(v) => {
                setF((x) => ({ ...x, lat: v.lat, lng: v.lng }));
                setDirty(true);
              }}
            />
          </div>
          <Field label="Latitude" req error={err('lat')}>
            <input type="number" step="any" value={f.lat ?? ''} onChange={(e) => set('lat', e.target.value === '' ? null : Number(e.target.value))} />
          </Field>
          <Field label="Longitude" req error={err('lng')} hint="Drag the marker to adjust. The pin is also used to spot the same property posted twice.">
            <input type="number" step="any" value={f.lng ?? ''} onChange={(e) => set('lng', e.target.value === '' ? null : Number(e.target.value))} />
          </Field>
        </div>
      </section>

      <section className="form-sec" id="sec-C">
        <h3>C. Area and floors</h3>
        <div className="grid">
          <Field label="C1 Chargeable area (sq ft)" req error={err('chargeableArea')}>
            {numIn('chargeableArea')}
          </Field>
          <Field label="C2 Carpet area (sq ft)" req error={err('carpetArea') ?? (carpet && Number(f.chargeableArea) && carpet > Number(f.chargeableArea) ? 'Carpet area cannot be more than chargeable area' : undefined)} hint="Measured on site">
            {numIn('carpetArea')}
          </Field>
          <Field label="C3 Number of floors" req error={err('floorCount')}>
            <select value={f.floorCount} onChange={(e) => set('floorCount', e.target.value as F['floorCount'])}>
              <option value="">Choose</option>
              {FLOOR_COUNTS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Frontage (ft)" req error={err('frontage')} hint="At the shutter line">
            {numIn('frontage')}
          </Field>
          {floors.length > 0 && (
            <div className="full stack" style={{ gap: 6 }}>
              <span className="f">
                <span className="lab">
                  C4 Carpet area of each floor (sq ft)<span className="req">*</span>
                </span>
              </span>
              <div className="grid three" style={{ padding: 0 }}>
                {floors.map((fl, i) => (
                  <Field key={fl} label={fl}>
                    <input
                      type="number"
                      min={0}
                      value={f.floorAreas[i] ?? ''}
                      onChange={(e) => {
                        const v = [...f.floorAreas];
                        v[i] = e.target.value;
                        set('floorAreas', v);
                      }}
                    />
                  </Field>
                ))}
              </div>
              {carpet > 0 && floorSum > 0 && Math.abs(floorSum - carpet) > 1 && (
                <span className="warnmsg">
                  Floors add up to {num(floorSum)} sq ft but carpet area is {num(carpet)} sq ft.
                </span>
              )}
            </div>
          )}
          {floors.length > 1 && (
            <Field group label="C5 Same layout on every floor" req hint="Yes: one floor plan is copied to every floor. No: draw one per floor.">
              <YesNo name="Same layout" value={f.sameLayout ? 'yes' : 'no'} onChange={(v) => set('sameLayout', v !== 'no')} />
            </Field>
          )}
          <Field label="C6 Ground to ceiling height (ft)" req error={err('ceilingHeight')}>
            {numIn('ceilingHeight')}
          </Field>
          <div className="full f" id="c7">
            <span className="lab">
              C7 Dimensions and shape<span className="req">*</span>
            </span>
            <span className="hint">Required. Do one of the two: paste the floor plan Drive link, or draw the floor plan below.</span>
            {!hasFloorPlanInput(f) && (submitTried || submitted) && <span className="warnmsg">Paste the floor plan Drive link or draw the floor plan before posting.</span>}
            <Field
              label="Floor plan Drive link"
              className="full"
              error={err('floorPlanLink') ?? (f.floorPlanLink && !/^https:\/\/drive\.google\.com\//.test(f.floorPlanLink) ? 'Use a Google Drive link' : undefined)}
              hint="Use this or the drawing below, not both. Share it as Anyone with the link: Viewer."
            >
              <input
                aria-label="Floor plan Drive link"
                value={f.floorPlanLink}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  setF((x) => ({ ...x, floorPlanLink: value, floorPlan: value ? null : x.floorPlan }));
                }}
                placeholder="https://drive.google.com/…"
              />
            </Field>
            <FloorPlanHelper
              value={f.floorPlan}
              floors={floors}
              floorAreas={f.floorAreas.map((x) => Number(x) || 0)}
              sameLayout={floors.length <= 1 || f.sameLayout}
              carpet={carpet || null}
              frontage={Number(f.frontage) || null}
              videoUrl={measureVideoUrl}
              drawVideoUrl={drawVideoUrl}
              onChange={(v) => setF((x) => ({ ...x, floorPlan: v, floorPlanLink: v ? '' : x.floorPlanLink }))}
            />
          </div>
        </div>
      </section>

      <section className="form-sec" id="sec-D">
        <h3>D. Commercials and landlord</h3>
        <div className="grid">
          <Field label="D1 Quoted rent (₹ per sq ft per month)" req error={err('rent')}>
            {numIn('rent')}
          </Field>
          <Field label="D2 Security deposit (months of rent)" req error={err('depositMonths')} hint="What the landlord expects">
            {numIn('depositMonths')}
          </Field>
          <Field label="Maintenance per month (₹)">{numIn('maintenance')}</Field>
          <Field label="Escalation">
            <input value={f.escalation} onChange={(e) => set('escalation', e.target.value)} placeholder="15% every 3 years" />
          </Field>
          <Field label="Landlord name" req error={err('landlordName')} hint="Never shown to other consultants">
            <input value={f.landlordName} onChange={(e) => set('landlordName', e.target.value)} />
          </Field>
          <Field label="Who you dealt with" req error={err('dealtWith')}>
            <select value={f.dealtWith} onChange={(e) => set('dealtWith', e.target.value as F['dealtWith'])}>
              <option value="">Choose</option>
              {DEALT_WITH.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <div className="full f">
            <span className="lab">Commission</span>
            <div className="grid" style={{ padding: 0 }}>
              <Field group label="Confirmed from landlord">
                <YesNo
                  name="Commission confirmed from landlord"
                  value={f.commissionConfirmed}
                  onChange={(v) => {
                    setF((x) => ({ ...x, commissionConfirmed: v, commissionDays: v === 'yes' ? x.commissionDays : '' }));
                    setDirty(true);
                  }}
                />
              </Field>
              {f.commissionConfirmed === 'yes' && (
                <Field label="How many days" error={err('commissionDays')} hint="Days of rent the landlord has agreed to pay as commission">
                  {numIn('commissionDays', { step: 1, max: 365, inputMode: 'numeric' })}
                </Field>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="form-sec" id="sec-E">
        <h3>E. Building and services</h3>
        <div className="grid">
          <Field label="E1 Total power capacity (kVA)" req error={err('powerKva')}>
            {numIn('powerKva')}
          </Field>
          <Field group label="E2 Power backup available" req>
            <YesNo name="Power backup" value={f.powerBackup} onChange={(v) => set('powerBackup', v)} />
          </Field>
          {floors.length > 1 && (
            <Field group label="E3 Lift available" req>
              <YesNo name="Lift" value={f.lift} onChange={(v) => set('lift', v)} />
            </Field>
          )}
          <Field label="E4 Bike parking" req error={err('bikeSlots')} hint="0 allowed">
            <div className="pair">
              <input type="number" min={0} placeholder="Slots" value={f.bikeSlots} onChange={(e) => set('bikeSlots', e.target.value)} />
              <select value={f.bikeType} onChange={(e) => set('bikeType', e.target.value as F['bikeType'])} aria-label="Bike parking type">
                <option value="">Open / covered</option>
                {PARKING_TYPES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
          </Field>
          <Field label="E5 Car parking" req error={err('carSlots')} hint="0 allowed">
            <div className="pair">
              <input type="number" min={0} placeholder="Slots" value={f.carSlots} onChange={(e) => set('carSlots', e.target.value)} />
              <select value={f.carType} onChange={(e) => set('carType', e.target.value as F['carType'])} aria-label="Car parking type">
                <option value="">Open / covered</option>
                {PARKING_TYPES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
          </Field>
          <Field label="E6 Toilets" req>
            <select value={f.toilets} onChange={(e) => set('toilets', e.target.value as F['toilets'])}>
              <option value="">Choose</option>
              {TOILET_OPTIONS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field group label="E7 Space for signage board outside" req>
            <YesNo name="Signage space" value={f.signageSpace} onChange={(v) => set('signageSpace', v)} />
          </Field>
        </div>
      </section>

      <section className="form-sec" id="sec-F">
        <h3>F. Inside the premises</h3>
        <div className="grid">
          {(floors.length === 0 || floors.includes('Ground')) && (
            <Field group label="F1 Septic tank or water tank below the property" req>
              <YesNo name="Septic or water tank" value={f.septicBelow} onChange={(v) => set('septicBelow', v)} />
            </Field>
          )}
          <Field group label="F2 Windows inside the premises" req>
            <YesNo name="Windows" value={f.windows} onChange={(v) => set('windows', v)} />
          </Field>
          <Field group label="F3 Electrical boards inside the premises" req>
            <YesNo name="Electrical boards" value={f.electricalBoards} onChange={(v) => set('electricalBoards', v)} />
          </Field>
        </div>
      </section>

      <section className="form-sec" id="sec-G">
        <h3>G. Status</h3>
        <div className="grid">
          <Field label="G1 Property status" req>
            <select value={f.condition} onChange={(e) => set('condition', e.target.value as F['condition'])}>
              <option value="">Choose</option>
              {PROPERTY_CONDITIONS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          {CONDITIONS_NEEDING_DATE.includes(f.condition) && (
            <Field label="G2 Expected available date" req error={err('availableDate')}>
              <input type="date" value={f.availableDate} onChange={(e) => set('availableDate', e.target.value)} />
            </Field>
          )}
        </div>
      </section>

      <section className="form-sec" id="sec-H">
        <h3>H. Photos and video</h3>
        <div className="grid">
          <Field
            group
            label="H1 Google Drive folder link"
            req
            className="full"
            info={
              <button type="button" className="infobtn" onClick={(e) => (e.preventDefault(), setSop(true))} aria-label="Open the photo and video SOP">
                i
              </button>
            }
            error={
              err('driveLink') ??
              (f.driveLink && !f.driveLink.startsWith(DRIVE_FOLDER_PREFIX)
                ? f.driveLink.startsWith('https://drive.google.com/')
                  ? 'Paste the folder link, not a file link'
                  : `The link must start with ${DRIVE_FOLDER_PREFIX}`
                : undefined)
            }
            hint="Make sure the folder is shared as Anyone with the link: Viewer. Shown only to Abacus."
          >
            <input aria-label="H1 Google Drive folder link" value={f.driveLink} onChange={(e) => set('driveLink', e.target.value.trim())} placeholder={`${DRIVE_FOLDER_PREFIX}…`} />
          </Field>
          <div className="full sopbox">
            <span>📋</span>
            <span>
              Name the folder <b>{property.code} {f.microMarket || f.city}</b> and follow the shot list.{' '}
              <button type="button" className="linkbtn" onClick={() => setSop(true)}>
                Open the photo and video SOP
              </button>
            </span>
          </div>
          <Field
            group
            label="H2 Additional notes"
            className="full"
            info={
              <button type="button" className="infobtn" onClick={(e) => (e.preventDefault(), setNotesHelp(true))} aria-label="What to write here">
                i
              </button>
            }
            hint={`${f.notes.length} / ${NOTES_MAX} characters. Only you and Abacus see these.`}
            error={err('notes')}
          >
            <textarea aria-label="H2 Additional notes" maxLength={NOTES_MAX} rows={5} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Brands nearby, footfall drivers, visibility, landlord points…" />
          </Field>
        </div>
      </section>

      {missing.length > 0 && (
        <div className="notice amber small" style={{ marginBottom: 12 }}>
          <b>Still required before posting:</b> {missing.join(', ')}.
        </div>
      )}
      <div className="row-flex">
        <Button className="primary" onClick={submit} loading={submitting}>
          {submitted ? 'Save changes' : 'Post property'}
        </Button>
        {!submitted && (
          <Button onClick={() => save(false)} loading={saving}>
            Save draft and finish later
          </Button>
        )}
      </div>

      {sop && <SopModal texts={texts} code={property.code} locality={f.microMarket || f.city} onClose={() => setSop(false)} />}
      {notesHelp && <NotesHelpModal text={texts.notesHelp} onClose={() => setNotesHelp(false)} />}
    </div>
  );
}
