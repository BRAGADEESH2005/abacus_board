'use client';
import { useState } from 'react';
import { api, ApiErr } from '@/components/ui/api';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { LocationMap } from '@/components/map';
import { coordsFromMapsUrl } from '@/lib/domain';

type MM = { id: string; name: string; lat: number | null; lng: number | null; radiusM: number; stretches: string[] };
type City = { id: string; name: string; code: string; state: string; lat: number | null; lng: number | null; enabled: boolean; microMarkets: MM[] };
type Fresh = { locations: { name: string; code: string; state: string; lat: number | null; lng: number | null; enabled: boolean; microMarkets: { name: string; lat: number | null; lng: number | null; radiusM: number; stretches: string[] }[] }[]; cities: { id: string; name: string; microMarkets: { id: string; name: string }[] }[] };

function merge(r: Fresh): City[] {
  return r.cities.map((c) => {
    const l = r.locations.find((x) => x.name === c.name)!;
    return {
      id: c.id,
      name: c.name,
      code: l.code,
      state: l.state,
      lat: l.lat,
      lng: l.lng,
      enabled: l.enabled,
      microMarkets: c.microMarkets.map((m) => {
        const lm = l.microMarkets.find((x) => x.name === m.name)!;
        return { id: m.id, name: m.name, lat: lm.lat, lng: lm.lng, radiusM: lm.radiusM, stretches: lm.stretches };
      }),
    };
  });
}

function MMEditor({ city, mm, onClose, onSaved }: { city: City; mm: MM | null; onClose: () => void; onSaved: (c: City[]) => void }) {
  const toast = useToast();
  const [name, setName] = useState(mm?.name ?? '');
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(mm?.lat != null && mm?.lng != null ? { lat: mm.lat, lng: mm.lng } : null);
  const [radius, setRadius] = useState(String(mm?.radiusM ?? 1200));
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const center = pos ?? (city.lat != null && city.lng != null ? { lat: city.lat, lng: city.lng } : { lat: 13.08, lng: 80.27 });
  const readLink = async () => {
    const c = coordsFromMapsUrl(link);
    if (c) return setPos(c);
    try {
      setPos(await api<{ lat: number; lng: number }>(`/api/geo/resolve?url=${encodeURIComponent(link)}`));
    } catch (e) {
      toast((e as ApiErr).message, 'error');
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      const body = mm
        ? { op: 'updateMM', cityId: city.id, mmId: mm.id, name, lat: pos?.lat ?? null, lng: pos?.lng ?? null, radiusM: Number(radius) }
        : { op: 'addMM', cityId: city.id, name, lat: pos?.lat ?? null, lng: pos?.lng ?? null, radiusM: Number(radius) };
      const r = await api<Fresh>('/api/admin/settings/locations', { body });
      onSaved(merge(r));
      toast(mm ? 'Micro market saved' : `${name} added to ${city.name}`, 'success');
      onClose();
    } catch (e) {
      toast((e as ApiErr).message, 'error');
    }
    setBusy(false);
  };
  return (
    <Modal
      title={mm ? `Edit ${mm.name}` : `Add a micro market in ${city.name}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <Button className="primary" onClick={save} loading={busy} disabled={!name.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid" style={{ padding: 0 }}>
        <Field label="Name" hint={mm ? 'Renaming updates every requirement, property and broker that uses it' : undefined}>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Map circle radius (m)" hint="Size of the shaded demand area on the admin map">
          <input type="number" min={100} max={20000} value={radius} onChange={(e) => setRadius(e.target.value)} />
        </Field>
        <Field label="Centre: paste a Google Maps link or tap the map" className="full">
          <div className="row-flex">
            <input className="input grow" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://maps.app.goo.gl/…" />
            <button className="btn small" onClick={readLink} disabled={!link.trim()}>
              Read pin
            </button>
          </div>
        </Field>
        <div className="full">
          <LocationMap center={center} value={pos} onChange={setPos} zoom={14} />
          <span className="hint">{pos ? `${pos.lat}, ${pos.lng}` : 'No centre set. The broker form map opens on the city centre until you set one.'}</span>
        </div>
      </div>
    </Modal>
  );
}

export function LocationsManager({ initial }: { initial: City[] }) {
  const toast = useToast();
  const [cities, setCities] = useState(initial);
  const [sel, setSel] = useState(initial.find((c) => c.enabled)?.id ?? initial[0]?.id ?? '');
  const [edit, setEdit] = useState<{ mm: MM | null } | null>(null);
  const [newCity, setNewCity] = useState({ name: '', code: '', state: '', lat: '', lng: '' });
  const [addingCity, setAddingCity] = useState(false);
  const [stretch, setStretch] = useState<Record<string, string>>({});
  const city = cities.find((c) => c.id === sel);

  const op = async (body: Record<string, unknown>, msg: string) => {
    try {
      const r = await api<Fresh>('/api/admin/settings/locations', { body });
      setCities(merge(r));
      toast(msg, 'success');
      return true;
    } catch (e) {
      toast((e as ApiErr).message, 'error');
      return false;
    }
  };

  return (
    <div className="two-col" style={{ gridTemplateColumns: '300px minmax(0,1fr)' }}>
      <div className="panel">
        <div className="ph">
          <h3>Cities</h3>
          <button className="btn tiny" onClick={() => setAddingCity((x) => !x)}>
            {addingCity ? 'Cancel' : 'Add city'}
          </button>
        </div>
        {addingCity && (
          <div className="pb stack" style={{ borderBottom: '1px solid var(--line)' }}>
            <input className="input" placeholder="City name" value={newCity.name} onChange={(e) => setNewCity((x) => ({ ...x, name: e.target.value }))} />
            <div className="pair">
              <input className="input" placeholder="Code (3 letters)" maxLength={3} value={newCity.code} onChange={(e) => setNewCity((x) => ({ ...x, code: e.target.value.toUpperCase() }))} />
              <input className="input" placeholder="State" value={newCity.state} onChange={(e) => setNewCity((x) => ({ ...x, state: e.target.value }))} />
            </div>
            <div className="pair">
              <input className="input" placeholder="Latitude" value={newCity.lat} onChange={(e) => setNewCity((x) => ({ ...x, lat: e.target.value }))} />
              <input className="input" placeholder="Longitude" value={newCity.lng} onChange={(e) => setNewCity((x) => ({ ...x, lng: e.target.value }))} />
            </div>
            <span className="hint">The code starts every property and requirement code in this city (PRP {newCity.code || 'XXX'} 0001). It cannot change later.</span>
            <Button
              className="small primary"
              onClick={async () => {
                if (await op({ op: 'addCity', ...newCity }, `${newCity.name} added`)) {
                  setNewCity({ name: '', code: '', state: '', lat: '', lng: '' });
                  setAddingCity(false);
                }
              }}
            >
              Save city
            </Button>
          </div>
        )}
        {cities.map((c) => (
          <button key={c.id} className="nitem" style={{ width: '100%', border: 0, borderBottom: '1px solid var(--line)', background: c.id === sel ? 'var(--maroon-soft)' : 'transparent', cursor: 'pointer', textAlign: 'left' }} onClick={() => setSel(c.id)}>
            <span className="grow">
              <b>
                {c.name} <span className="code">{c.code}</span>
              </b>
              <span className="small muted">
                {c.state} · {c.microMarkets.length} micro markets
              </span>
            </span>
            {!c.enabled && <span className="pill p-no">Off</span>}
          </button>
        ))}
      </div>
      {city && (
        <div className="panel">
          <div className="ph">
            <h3>
              {city.name} <span className="code">{city.code}</span>
            </h3>
            <label className="row-flex small" style={{ gap: 6 }}>
              <input type="checkbox" checked={city.enabled} onChange={(e) => op({ op: 'updateCity', cityId: city.id, enabled: e.target.checked }, e.target.checked ? `${city.name} switched on` : `${city.name} switched off`)} style={{ accentColor: 'var(--maroon)' }} />
              On the city lists (sign up, profile, forms)
            </label>
            <button className="btn small primary" onClick={() => setEdit({ mm: null })}>
              Add micro market
            </button>
          </div>
          <div className="pb">
            {city.microMarkets.length === 0 && <div className="muted">No micro markets yet. Brokers cannot post in {city.name} until you add one.</div>}
            {city.microMarkets.map((m) => (
              <div key={m.id} className="rowline" style={{ alignItems: 'flex-start' }}>
                <span className="grow">
                  <b>{m.name}</b>{' '}
                  <span className="muted small">{m.lat != null ? `${m.lat.toFixed(4)}, ${m.lng?.toFixed(4)} · ${m.radiusM} m` : 'no map centre'}</span>
                  <div className="chips" style={{ marginTop: 6 }}>
                    {m.stretches.map((s) => (
                      <span key={s} className="chip">
                        {s}{' '}
                        <button className="linkbtn" style={{ textDecoration: 'none' }} aria-label={`Remove ${s}`} onClick={() => op({ op: 'removeStretch', cityId: city.id, mmId: m.id, stretch: s }, `${s} removed`)}>
                          ✕
                        </button>
                      </span>
                    ))}
                    <span className="row-flex" style={{ gap: 4 }}>
                      <input
                        className="input"
                        style={{ width: 170, padding: '3px 8px', fontSize: 13 }}
                        placeholder="Add stretch"
                        value={stretch[m.id] ?? ''}
                        onChange={(e) => setStretch((x) => ({ ...x, [m.id]: e.target.value }))}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && (stretch[m.id] ?? '').trim()) {
                            if (await op({ op: 'addStretch', cityId: city.id, mmId: m.id, stretch: stretch[m.id] }, 'Stretch added')) setStretch((x) => ({ ...x, [m.id]: '' }));
                          }
                        }}
                      />
                      <button
                        className="btn tiny"
                        disabled={!(stretch[m.id] ?? '').trim()}
                        onClick={async () => {
                          if (await op({ op: 'addStretch', cityId: city.id, mmId: m.id, stretch: stretch[m.id] }, 'Stretch added')) setStretch((x) => ({ ...x, [m.id]: '' }));
                        }}
                      >
                        Add
                      </button>
                    </span>
                  </div>
                </span>
                <span className="row-flex">
                  <button className="btn tiny" onClick={() => setEdit({ mm: m })}>
                    Edit
                  </button>
                  <button className="btn tiny ghost" onClick={() => confirm(`Remove ${m.name}?`) && op({ op: 'removeMM', cityId: city.id, mmId: m.id }, `${m.name} removed`)}>
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {edit && city && <MMEditor city={city} mm={edit.mm} onClose={() => setEdit(null)} onSaved={setCities} />}
    </div>
  );
}
