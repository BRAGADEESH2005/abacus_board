'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';

export type DemandRow = { state: string; city: string; microMarket: string; count: number };

const sum = (rows: DemandRow[]) => rows.reduce((s, r) => s + r.count, 0);

/** Dashboard "Properties Required": open requirements by state, city and micro market, with filters. */
export function PropertiesRequired({ rows }: { rows: DemandRow[] }) {
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [mm, setMm] = useState('');

  const states = useMemo(() => [...new Set(rows.map((r) => r.state))].sort(), [rows]);
  const cities = useMemo(() => [...new Set(rows.filter((r) => !state || r.state === state).map((r) => r.city))].sort(), [rows, state]);
  const mms = useMemo(() => [...new Set(rows.filter((r) => (!state || r.state === state) && (!city || r.city === city)).map((r) => r.microMarket))].sort(), [rows, state, city]);

  const shown = rows.filter((r) => (!state || r.state === state) && (!city || r.city === city) && (!mm || r.microMarket === mm));
  const filtered = Boolean(state || city || mm);

  // state > city > micro market, biggest first
  const tree = useMemo(() => {
    const byState = new Map<string, Map<string, DemandRow[]>>();
    for (const r of shown) {
      if (!byState.has(r.state)) byState.set(r.state, new Map());
      const c = byState.get(r.state)!;
      c.set(r.city, [...(c.get(r.city) ?? []), r]);
    }
    return [...byState.entries()]
      .map(([s, c]) => ({
        state: s,
        total: sum([...c.values()].flat()),
        cities: [...c.entries()].map(([name, list]) => ({ name, total: sum(list), list: [...list].sort((a, b) => b.count - a.count) })).sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total);
  }, [shown]);

  if (!rows.length) {
    return (
      <div className="empty">
        <b>No open requirements right now</b>
        Abacus will email you when a requirement is posted in your city.
      </div>
    );
  }

  return (
    <>
      <div className="filters row-flex" style={{ marginBottom: 12 }}>
        <select className="input" style={{ width: 'auto' }} value={state} onChange={(e) => (setState(e.target.value), setCity(''), setMm(''))} aria-label="State">
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="input" style={{ width: 'auto' }} value={city} onChange={(e) => (setCity(e.target.value), setMm(''))} aria-label="City">
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="input" style={{ width: 'auto' }} value={mm} onChange={(e) => setMm(e.target.value)} aria-label="Micro market">
          <option value="">All micro markets</option>
          {mms.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        {filtered && (
          <button className="btn small ghost" onClick={() => (setState(''), setCity(''), setMm(''))}>
            Clear
          </button>
        )}
        <span className="muted small">{sum(shown)} open requirements</span>
      </div>
      {tree.length === 0 ? (
        <div className="empty">
          <b>Nothing open here</b>
          Try another state, city or micro market.
        </div>
      ) : (
        <div className="tree">
          {tree.map((s) => (
            // Collapsed until the consultant narrows it down, so the page does not open as one long list.
            <details key={`${s.state}|${filtered}`} open={filtered || tree.length === 1}>
              <summary>
                {s.state} <span className="count">{s.total}</span>
              </summary>
              {s.cities.map((c) => (
                <div className="city" key={c.name}>
                  <b>{c.name}</b> <span className="count">{c.total}</span>
                  <div className="locs">
                    {c.list.map((l) => (
                      <Link key={l.microMarket} href={`/broker/requirements?city=${encodeURIComponent(c.name)}&mm=${encodeURIComponent(l.microMarket)}`}>
                        {l.microMarket} ({l.count})
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </details>
          ))}
        </div>
      )}
    </>
  );
}
