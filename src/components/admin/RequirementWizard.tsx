'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiErr } from '@/components/ui/api';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { AdminOnly, RealtorsSee } from '@/components/ui/Badges';
import { CONDITION_ACCEPTED, FEE_OPTIONS, FORMATS, PREFERRED_FLOORS, SECTORS, STORE_MODELS } from '@/lib/constants';
import { rentBand } from '@/lib/domain';
import { inrShort } from '@/lib/format';
import type { LocationList } from '@/lib/settings';

type BrandHit = { id: string; name: string; sector: string; contactName: string; designation: string; phone: string; email: string; storeModel: string; fee: number; paysNothing: boolean };
type Ov = { carpetMin: string; carpetMax: string; rentMin: string; rentMax: string };
type Row = { stretches: string[]; stores: string; carpetMin: string; carpetMax: string; rentMin: string; rentMax: string; overrides: Record<string, Ov>; expanded: boolean };

const emptyBrand = { id: '', name: '', sector: '', contactName: '', designation: '', phone: '', email: '', storeModel: '', fee: '30', paysNothing: false };
const emptyValues = {
  formats: [] as string[],
  carpetMin: '',
  carpetMax: '',
  rentMin: '',
  rentMax: '',
  minFrontage: '',
  floors: [] as string[],
  minCeiling: '',
  minPowerKva: '',
  conditionAccepted: '',
  parkingCars: '',
  parkingBikes: '',
  signage: '',
  otherSpecs: '',
  maxDepositMonths: '',
  leaseYears: '',
  lockInYears: '',
  priority: 'normal',
  receivedOn: '',
  internalNotes: '',
};

function Chips({ options, value, onChange }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <label key={o} className={`choice ${on ? 'on' : ''}`}>
            <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])} />
            {o}
          </label>
        );
      })}
    </div>
  );
}

export function RequirementWizard({ locations: initialLocations }: { locations: LocationList }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [locations, setLocations] = useState(initialLocations);
  const [brand, setBrand] = useState(emptyBrand);
  const [v, setV] = useState(emptyValues);
  const [hits, setHits] = useState<BrandHit[]>([]);
  const [showHits, setShowHits] = useState(false);
  const [more, setMore] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [mms, setMms] = useState<Record<string, string[]>>({});
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [newStretch, setNewStretch] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setB = (k: keyof typeof emptyBrand, val: string | boolean) => setBrand((x) => ({ ...x, [k]: val }));
  const setVal = (k: keyof typeof emptyValues, val: string | string[]) => setV((x) => ({ ...x, [k]: val }));

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (brand.id || brand.name.trim().length < 1) {
      setHits([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await api<{ brands: BrandHit[] }>(`/api/admin/brands?q=${encodeURIComponent(brand.name.trim())}`);
        setHits(r.brands);
      } catch {
        /* ignore */
      }
    }, 250);
  }, [brand.name, brand.id]);

  const pickBrand = (h: BrandHit) => {
    setBrand({ id: h.id, name: h.name, sector: h.sector, contactName: h.contactName, designation: h.designation, phone: h.phone, email: h.email, storeModel: h.storeModel, fee: String(h.fee), paysNothing: h.paysNothing });
    setShowHits(false);
  };

  const keys = useMemo(() => cities.flatMap((c) => (mms[c] ?? []).map((m) => `${c}|${m}`)), [cities, mms]);
  useEffect(() => {
    setRows((old) => {
      const next: Record<string, Row> = {};
      for (const k of keys) next[k] = old[k] ?? { stretches: [], stores: '1', carpetMin: '', carpetMax: '', rentMin: '', rentMax: '', overrides: {}, expanded: false };
      return next;
    });
  }, [keys]);

  const eff = (r: Row, k: 'carpetMin' | 'carpetMax' | 'rentMin' | 'rentMax') => (r[k] !== '' ? r[k] : v[k]);
  const setRow = (k: string, patch: Partial<Row>) => setRows((x) => ({ ...x, [k]: { ...x[k]!, ...patch } }));

  const step1Errors = () => {
    const e: Record<string, string> = {};
    if (!brand.name.trim()) e['brand.name'] = 'Enter or pick the brand';
    if (!brand.sector) e['brand.sector'] = 'Pick a sector';
    if (!v.formats.length) e['values.formats'] = 'Tick at least one format';
    if (!(Number(v.carpetMin) > 0)) e['values.carpetMin'] = 'Required';
    if (!(Number(v.carpetMax) > 0)) e['values.carpetMax'] = 'Required';
    else if (Number(v.carpetMax) < Number(v.carpetMin)) e['values.carpetMax'] = 'Max must be at least min';
    if (!(Number(v.rentMin) > 0)) e['values.rentMin'] = 'Required';
    if (!(Number(v.rentMax) > 0)) e['values.rentMax'] = 'Required';
    else if (Number(v.rentMax) < Number(v.rentMin)) e['values.rentMax'] = 'Max must be at least min';
    if (!v.floors.length) e['values.floors'] = 'Pick at least one floor';
    return e;
  };

  const next = () => {
    if (step === 1) {
      const e = step1Errors();
      setFields(e);
      if (Object.keys(e).length) return toast('Fill the highlighted brand fields first', 'error');
    }
    if (step === 2 && !keys.length) return toast('Pick at least one micro market', 'error');
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addStretch = async (city: string, mm: string) => {
    const key = `${city}|${mm}`;
    const name = (newStretch[key] ?? '').trim();
    if (!name) return;
    try {
      const r = await api<{ locations: LocationList }>('/api/admin/settings/locations', { body: { op: 'addStretch', city, microMarket: mm, stretch: name } });
      setLocations(r.locations.filter((c) => c.enabled));
      setRow(key, { stretches: [...new Set([...(rows[key]?.stretches ?? []), name])] });
      setNewStretch((x) => ({ ...x, [key]: '' }));
      toast(`Saved ${name} to ${mm}`, 'success');
    } catch (e) {
      toast((e as ApiErr).message, 'error');
    }
  };

  const potential = keys.reduce((sum, k) => {
    const r = rows[k];
    if (!r || brand.paysNothing) return sum;
    const rm = (Number(eff(r, 'rentMin')) + Number(eff(r, 'rentMax'))) / 2;
    const cm = (Number(eff(r, 'carpetMin')) + Number(eff(r, 'carpetMax'))) / 2;
    return sum + rm * cm * (Number(brand.fee) / 30) * (Number(r.stores) || 1);
  }, 0);

  const post = async () => {
    setBusy(true);
    setFields({});
    const body = {
      brand: { ...brand, fee: Number(brand.fee) },
      values: v,
      rows: keys.map((k) => {
        const [city, microMarket] = k.split('|') as [string, string];
        const r = rows[k]!;
        return {
          city,
          microMarket,
          stretches: r.stretches,
          storesWanted: Number(r.stores) || 1,
          carpetMin: eff(r, 'carpetMin'),
          carpetMax: eff(r, 'carpetMax'),
          rentMin: eff(r, 'rentMin'),
          rentMax: eff(r, 'rentMax'),
          overrides: r.stretches
            .filter((s) => r.overrides[s] && Object.values(r.overrides[s]!).some((x) => x !== ''))
            .map((s) => {
              const o = r.overrides[s]!;
              return {
                stretch: s,
                carpetMin: o.carpetMin || eff(r, 'carpetMin'),
                carpetMax: o.carpetMax || eff(r, 'carpetMax'),
                rentMin: o.rentMin || eff(r, 'rentMin'),
                rentMax: o.rentMax || eff(r, 'rentMax'),
              };
            }),
        };
      }),
    };
    try {
      const r = await api<{ brandId: string; askCode: string; created: { code: string }[] }>('/api/admin/requirements', { body });
      toast(`${r.askCode}: posted ${r.created.length} requirement${r.created.length === 1 ? '' : 's'}`, 'success');
      router.push(`/admin/brands/${r.brandId}`);
      router.refresh();
    } catch (e) {
      const err = e as ApiErr;
      setFields(err.fields ?? {});
      toast(err.message, 'error');
      if (err.fields && Object.keys(err.fields).some((k) => k.startsWith('brand') || k.startsWith('values'))) setStep(1);
      setBusy(false);
    }
  };

  const enabledCities = locations.filter((c) => c.enabled);
  const fe = (k: string) => fields[k];

  return (
    <div>
      <div className="stepper">
        {['1. Brand', '2. Where', '3. Review and post'].map((t, i) => (
          <div key={t} className={step === i + 1 ? 'cur' : step > i + 1 ? 'done' : ''}>
            {step > i + 1 ? '✓ ' : ''}
            {t}
          </div>
        ))}
      </div>

      {step === 1 && (
        <>
          <div className="legend">
            <AdminOnly /> hidden from realtors <RealtorsSee /> shown on the requirement <span className="tag band">Band only</span> realtors see a range, never the exact budget
          </div>
          <section className="form-sec private">
            <h3>
              Brand and deal <AdminOnly /> <small className="hint">Saved in a separate record realtors cannot open</small>
            </h3>
            <div className="grid">
              <Field group label="Brand name" req tag={<AdminOnly />} error={fe('brand.name')} hint={brand.id ? 'Existing brand: changes here update the brand record' : 'Type to pick from the brand list, or add a new one'}>
                <span style={{ position: 'relative', display: 'block' }}>
                  <input
                    value={brand.name}
                    onChange={(e) => {
                      setBrand((x) => ({ ...x, id: '', name: e.target.value }));
                      setShowHits(true);
                    }}
                    onFocus={() => setShowHits(true)}
                    onBlur={() => setTimeout(() => setShowHits(false), 150)}
                    autoComplete="off"
                    aria-label="Brand name"
                    placeholder="Lenskart"
                    style={{ width: '100%' }}
                  />
                  {showHits && hits.length > 0 && !brand.id && (
                    <span className="menu-pop" style={{ left: 0, right: 'auto', width: '100%' }}>
                      {hits.map((h) => (
                        <button type="button" key={h.id} onMouseDown={() => pickBrand(h)}>
                          <b>{h.name}</b> <span className="muted">{h.sector}</span>
                        </button>
                      ))}
                    </span>
                  )}
                </span>
              </Field>
              <Field label="Sector" req tag={<RealtorsSee />} error={fe('brand.sector')}>
                <select value={brand.sector} onChange={(e) => setB('sector', e.target.value)}>
                  <option value="">Choose</option>
                  {SECTORS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Brand contact name" tag={<AdminOnly />} hint="Highest designation we deal with">
                <input value={brand.contactName} onChange={(e) => setB('contactName', e.target.value)} />
              </Field>
              <Field label="Designation" tag={<AdminOnly />}>
                <input value={brand.designation} onChange={(e) => setB('designation', e.target.value)} placeholder="Expansion manager, South" />
              </Field>
              <Field label="Contact phone" tag={<AdminOnly />} error={fe('brand.phone')}>
                <input type="tel" value={brand.phone} onChange={(e) => setB('phone', e.target.value)} placeholder="+91" />
              </Field>
              <Field label="Our fee" req tag={<AdminOnly />} hint="Used for potential revenue">
                <select value={brand.fee} onChange={(e) => setB('fee', e.target.value)}>
                  {FEE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="full row-flex small" style={{ gap: 8, alignItems: 'flex-start' }}>
                <input type="checkbox" checked={brand.paysNothing} onChange={(e) => setB('paysNothing', e.target.checked)} style={{ accentColor: 'var(--maroon)', marginTop: 3 }} />
                <span>
                  <b>Brand pays nothing</b> <RealtorsSee text="Realtors see a notice" />
                  <div className="hint">Realtors are told, before they pitch, that commission sharing applies. Potential revenue counts this brand as zero.</div>
                </span>
              </label>
            </div>
          </section>

          <section className="form-sec">
            <h3>
              What the brand needs <RealtorsSee /> <small className="hint">Copied to every location; each location can override size and rent in step 3</small>
            </h3>
            <div className="grid">
              <Field group label="Format" req className="full" error={fe('values.formats')} hint="Tick every format that works">
                <Chips options={FORMATS} value={v.formats} onChange={(x) => setVal('formats', x)} />
              </Field>
              <Field label="Carpet area min (sq ft)" req error={fe('values.carpetMin')}>
                <input type="number" min={0} value={v.carpetMin} onChange={(e) => setVal('carpetMin', e.target.value)} />
              </Field>
              <Field label="Carpet area max (sq ft)" req error={fe('values.carpetMax')}>
                <input type="number" min={0} value={v.carpetMax} onChange={(e) => setVal('carpetMax', e.target.value)} />
              </Field>
              <Field label="Rent min (₹ per sq ft per month)" req tag={<span className="tag band">Band only</span>} error={fe('values.rentMin')}>
                <input type="number" min={0} value={v.rentMin} onChange={(e) => setVal('rentMin', e.target.value)} />
              </Field>
              <Field
                label="Rent max (₹ per sq ft per month)"
                req
                tag={<span className="tag band">Band only</span>}
                error={fe('values.rentMax')}
                hint={Number(v.rentMin) > 0 && Number(v.rentMax) >= Number(v.rentMin) ? `Realtors will see ₹${rentBand(Number(v.rentMin), Number(v.rentMax)).min} to ${rentBand(Number(v.rentMin), Number(v.rentMax)).max}` : undefined}
              >
                <input type="number" min={0} value={v.rentMax} onChange={(e) => setVal('rentMax', e.target.value)} />
              </Field>
              <Field label="Minimum frontage (ft)">
                <input type="number" min={0} value={v.minFrontage} onChange={(e) => setVal('minFrontage', e.target.value)} />
              </Field>
              <Field label="Minimum ground to ceiling height (ft)">
                <input type="number" min={0} value={v.minCeiling} onChange={(e) => setVal('minCeiling', e.target.value)} />
              </Field>
              <Field group label="Preferred floors" req className="full" error={fe('values.floors')}>
                <Chips options={PREFERRED_FLOORS} value={v.floors} onChange={(x) => setVal('floors', x)} />
              </Field>
              <Field label="Minimum power required (kVA)">
                <input type="number" min={0} value={v.minPowerKva} onChange={(e) => setVal('minPowerKva', e.target.value)} />
              </Field>
              <Field label="Priority" tag={<RealtorsSee />}>
                <select value={v.priority} onChange={(e) => setVal('priority', e.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="form-sec">
            <h3>
              <button type="button" className="linkbtn" onClick={() => setMore((m) => !m)}>
                {more ? '▾' : '▸'} More details (optional)
              </button>
            </h3>
            {more && (
              <div className="grid">
                <Field label="Store model" tag={<AdminOnly />}>
                  <select value={brand.storeModel} onChange={(e) => setB('storeModel', e.target.value)}>
                    <option value="">Not set</option>
                    {STORE_MODELS.map((s) => (
                      <option key={s} value={s}>
                        {s === 'COCO' ? 'Company owned (COCO)' : 'Franchise (FOCO)'}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Contact email" tag={<AdminOnly />} error={fe('brand.email')}>
                  <input type="email" value={brand.email} onChange={(e) => setB('email', e.target.value)} />
                </Field>
                <Field label="Requirement received on" tag={<AdminOnly />}>
                  <input type="date" value={v.receivedOn} onChange={(e) => setVal('receivedOn', e.target.value)} />
                </Field>
                <Field label="Condition accepted" tag={<RealtorsSee />}>
                  <select value={v.conditionAccepted} onChange={(e) => setVal('conditionAccepted', e.target.value)}>
                    <option value="">Not set</option>
                    {CONDITION_ACCEPTED.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Parking: cars" tag={<RealtorsSee />}>
                  <input type="number" min={0} value={v.parkingCars} onChange={(e) => setVal('parkingCars', e.target.value)} />
                </Field>
                <Field label="Parking: two wheelers" tag={<RealtorsSee />}>
                  <input type="number" min={0} value={v.parkingBikes} onChange={(e) => setVal('parkingBikes', e.target.value)} />
                </Field>
                <Field label="Signage" tag={<RealtorsSee />}>
                  <input value={v.signage} onChange={(e) => setVal('signage', e.target.value)} placeholder="Full width fascia sign" />
                </Field>
                <Field label="Maximum deposit (months)" tag={<RealtorsSee />}>
                  <input type="number" min={0} value={v.maxDepositMonths} onChange={(e) => setVal('maxDepositMonths', e.target.value)} />
                </Field>
                <Field label="Lease term (years)" tag={<RealtorsSee />}>
                  <input type="number" min={0} value={v.leaseYears} onChange={(e) => setVal('leaseYears', e.target.value)} />
                </Field>
                <Field label="Lock in (years)" tag={<RealtorsSee />}>
                  <input type="number" min={0} value={v.lockInYears} onChange={(e) => setVal('lockInYears', e.target.value)} />
                </Field>
                <Field label="Other specifications" tag={<RealtorsSee />} className="full" hint="Never name the brand here">
                  <textarea value={v.otherSpecs} onChange={(e) => setVal('otherSpecs', e.target.value)} placeholder="Corner unit preferred" />
                </Field>
                <Field label="Internal notes" tag={<AdminOnly />} className="full">
                  <textarea value={v.internalNotes} onChange={(e) => setVal('internalNotes', e.target.value)} placeholder="Brand also checking Valasaravakkam" />
                </Field>
              </div>
            )}
          </section>
        </>
      )}

      {step === 2 && (
        <>
          <section className="form-sec">
            <h3>Cities</h3>
            <div className="grid">
              <div className="full">
                <Chips options={enabledCities.map((c) => c.name)} value={cities} onChange={setCities} />
              </div>
            </div>
          </section>
          {cities.map((c) => {
            const city = locations.find((x) => x.name === c);
            return (
              <section key={c} className="form-sec">
                <h3>Micro markets in {c}</h3>
                <div className="grid">
                  <div className="full">
                    {city?.microMarkets.length ? (
                      <Chips options={city.microMarkets.map((m) => m.name)} value={mms[c] ?? []} onChange={(x) => setMms((o) => ({ ...o, [c]: x }))} />
                    ) : (
                      <span className="muted">No micro markets for {c} yet. Add them in Settings.</span>
                    )}
                  </div>
                  {(mms[c] ?? []).map((m) => {
                    const key = `${c}|${m}`;
                    const row = rows[key];
                    const mmInfo = city?.microMarkets.find((x) => x.name === m);
                    if (!row) return null;
                    return (
                      <div key={key} className="full panel" style={{ padding: 12 }}>
                        <div className="spread">
                          <b>{m}</b>
                          <label className="row-flex small" style={{ gap: 6 }}>
                            Stores wanted
                            <input className="input" style={{ width: 70 }} type="number" min={1} value={row.stores} onChange={(e) => setRow(key, { stores: e.target.value })} />
                          </label>
                        </div>
                        <div className="chips" style={{ marginTop: 8 }}>
                          <label className={`choice ${row.stretches.length === 0 ? 'on' : ''}`}>
                            <input type="checkbox" checked={row.stretches.length === 0} onChange={() => setRow(key, { stretches: [] })} />
                            Anywhere in this micro market
                          </label>
                          {(mmInfo?.stretches ?? []).map((s) => {
                            const on = row.stretches.includes(s);
                            return (
                              <label key={s} className={`choice ${on ? 'on' : ''}`}>
                                <input type="checkbox" checked={on} onChange={() => setRow(key, { stretches: on ? row.stretches.filter((x) => x !== s) : [...row.stretches, s] })} />
                                {s}
                              </label>
                            );
                          })}
                        </div>
                        <div className="row-flex" style={{ marginTop: 8 }}>
                          <input className="input" style={{ maxWidth: 240 }} placeholder="Add stretch (e.g. 2nd Avenue)" value={newStretch[key] ?? ''} onChange={(e) => setNewStretch((x) => ({ ...x, [key]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStretch(c, m))} />
                          <button type="button" className="btn small" onClick={() => addStretch(c, m)}>
                            Add stretch
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </>
      )}

      {step === 3 && (
        <>
          <p className="lead">
            One row per micro market, with the brand values filled in. Rent and size often differ by location: edit any row, or expand it to set values per stretch. Posting creates every row at once, each with its own REQ code, grouped under one brand ask.
          </p>
          <div className="tw">
            <table className="t">
              <thead>
                <tr>
                  <th>City</th>
                  <th>Micro market</th>
                  <th>Stretches</th>
                  <th className="num">Stores</th>
                  <th>Carpet min</th>
                  <th>Carpet max</th>
                  <th>Rent min</th>
                  <th>Rent max</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const [c, m] = k.split('|') as [string, string];
                  const r = rows[k];
                  if (!r) return null;
                  const ov = (['carpetMin', 'carpetMax', 'rentMin', 'rentMax'] as const).some((f) => r[f] !== '' && r[f] !== v[f]);
                  return [
                    <tr key={k}>
                      <td>{c}</td>
                      <td>
                        <b>{m}</b>
                        {ov && <div className="hint">overridden</div>}
                      </td>
                      <td className="small">{r.stretches.length ? r.stretches.join(', ') : 'Anywhere'}</td>
                      <td className="num">
                        <input type="number" min={1} value={r.stores} onChange={(e) => setRow(k, { stores: e.target.value })} style={{ width: 64 }} />
                      </td>
                      {(['carpetMin', 'carpetMax', 'rentMin', 'rentMax'] as const).map((f) => (
                        <td key={f}>
                          <input type="number" min={0} value={eff(r, f)} onChange={(e) => setRow(k, { [f]: e.target.value } as Partial<Row>)} />
                        </td>
                      ))}
                      <td>
                        {r.stretches.length > 0 && (
                          <button type="button" className="linkbtn small" onClick={() => setRow(k, { expanded: !r.expanded })}>
                            {r.expanded ? 'Hide' : 'Per stretch'}
                          </button>
                        )}
                      </td>
                    </tr>,
                    r.expanded &&
                      r.stretches.map((s) => {
                        const o = r.overrides[s] ?? { carpetMin: '', carpetMax: '', rentMin: '', rentMax: '' };
                        return (
                          <tr key={`${k}|${s}`} style={{ background: 'var(--sunk)' }}>
                            <td />
                            <td colSpan={3} className="small">
                              ↳ {s}
                            </td>
                            {(['carpetMin', 'carpetMax', 'rentMin', 'rentMax'] as const).map((f) => (
                              <td key={f}>
                                <input type="number" min={0} placeholder={eff(r, f)} value={o[f]} onChange={(e) => setRow(k, { overrides: { ...r.overrides, [s]: { ...o, [f]: e.target.value } } })} />
                              </td>
                            ))}
                            <td />
                          </tr>
                        );
                      }),
                  ];
                })}
              </tbody>
            </table>
          </div>
          <div className="notice amber" style={{ marginTop: 12 }}>
            Potential revenue for this ask: <b>{inrShort(potential)}</b> if every store closes ({brand.paysNothing ? 'brand pays nothing' : `${brand.fee} days rent per store`}). Worked out from each location row.
          </div>
          {Object.keys(fields).length > 0 && <div className="notice" style={{ marginTop: 12 }}>{Object.values(fields)[0]}</div>}
        </>
      )}

      <div className="row-flex" style={{ marginTop: 16 }}>
        {step > 1 && (
          <button className="btn" onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
        )}
        {step < 3 ? (
          <button className="btn primary" onClick={next}>
            Next
          </button>
        ) : (
          <Button className="primary" onClick={post} loading={busy}>
            Post {keys.length} requirement{keys.length === 1 ? '' : 's'}
          </Button>
        )}
      </div>
    </div>
  );
}
