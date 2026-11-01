import type { Metadata } from 'next';
import Link from 'next/link';
import { pageAdmin } from '@/lib/auth';
import { evaluateMatch } from '@/lib/domain';
import { fmtDate, num } from '@/lib/format';
import { demand, loadBoard, matchPropInput, matchReqInput, matchable } from '@/lib/services/board';
import { CitySelect, PitchButton } from '@/components/admin/actions';
import { StageBadge } from '@/components/ui/Badges';

export const metadata: Metadata = { title: 'Demand tracker' };

export default async function DemandPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageAdmin();
  const sp = await searchParams;
  const city = sp.city ?? '';
  const b = await loadBoard();
  const rows = demand(b, city || undefined);
  const cities = [...new Set(b.reqs.filter((r) => r.status === 'open').map((r) => r.city))].sort();
  const sel = sp.mm ? rows.find((r) => `${r.city}|${r.microMarket}` === sp.mm) : null;

  let grid: React.ReactNode = null;
  if (sel) {
    const reqs = sel.reqIds.map((id) => b.reqById.get(id)!).filter(Boolean);
    const props = b.props.filter((p) => p.city === sel.city && p.microMarket === sel.microMarket);
    const cell = new Map<string, { fits: boolean; pitch?: { stage: string; at: Date } }>();
    for (const p of props)
      for (const r of reqs) {
        const k = `${p._id}|${r.id}`;
        const pitch = (b.pitchesByReq.get(r.id) ?? []).find((x) => x.property.toString() === p._id.toString());
        cell.set(k, { fits: matchable(p) && evaluateMatch(matchReqInput(r), matchPropInput(p)).fits, pitch: pitch ? { stage: pitch.stage, at: pitch.createdAt } : undefined });
      }
    const relevant = props.filter((p) => reqs.some((r) => cell.get(`${p._id}|${r.id}`)?.fits || cell.get(`${p._id}|${r.id}`)?.pitch));
    const others = props.filter((p) => !relevant.includes(p));
    grid = (
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="ph">
          <h3>
            {sel.microMarket}, {sel.city}: which property went to which brand
          </h3>
          <Link className="btn small ghost" href={`/admin/demand${city ? `?city=${city}` : ''}`}>
            Close
          </Link>
        </div>
        {props.length === 0 ? (
          <div className="pb muted">No broker property in this micro market yet. This is demand with no supply.</div>
        ) : (
          <div className="tw" style={{ border: 0, borderRadius: 0 }}>
            <table className="t grid-matrix">
              <thead>
                <tr>
                  <th>Property</th>
                  {reqs.map((r) => (
                    <th key={r.id}>
                      <Link href={`/admin/brands/${r.brand._id}`}>{r.brand.name}</Link>
                      <div className="code">{r.code}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...relevant, ...others].map((p) => (
                  <tr key={p._id.toString()}>
                    <td>
                      <Link className="mono" href={`/admin/properties/${p._id}`}>
                        {p.code}
                      </Link>
                      <div className="muted">
                        {num(p.carpetArea)} sq ft{!relevant.includes(p) ? ' · does not fit' : ''}
                        {p.listingStatus !== 'available' ? ` · ${p.listingStatus.replace('_', ' ')}` : ''}
                      </div>
                    </td>
                    {reqs.map((r) => {
                      const c = cell.get(`${p._id}|${r.id}`)!;
                      return (
                        <td key={r.id} style={c.fits && !c.pitch ? { background: '#fff7f7' } : undefined}>
                          {c.pitch ? (
                            <>
                              <StageBadge stage={c.pitch.stage} />
                              <div className="muted">{fmtDate(c.pitch.at)}</div>
                            </>
                          ) : matchable(p) && r.status === 'open' ? (
                            <PitchButton className={c.fits ? 'tiny primary' : 'tiny'} label={c.fits ? 'Pitch (fits)' : 'Pitch'} pairs={[{ propertyId: p._id.toString(), requirementId: r.id }]} />
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="page">
      <div className="pagehead">
        <div>
          <h1>Demand tracker</h1>
          <p className="lead">One row per micro market. A brand counts as not pitched when a fitting property exists there and no pitch links them; those rows are red and show in the dashboard pending list.</p>
        </div>
        <CitySelect cities={cities} value={city} />
      </div>
      {rows.length === 0 ? (
        <div className="empty">
          <b>No open requirements</b>
          <Link href="/admin/requirements/new">Post a requirement</Link>
        </div>
      ) : (
        <div className="tw">
          <table className="t">
            <thead>
              <tr>
                <th>Micro market</th>
                <th className="num">Brands asking</th>
                <th className="num">Fitting properties</th>
                <th className="num">Brands pitched</th>
                <th>Not pitched yet</th>
                <th>Last pitch</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.city}|${r.microMarket}`} className={r.notPitched ? 'red' : ''}>
                  <td>
                    <b>{r.microMarket}</b>
                    <div className="muted">{r.city}</div>
                  </td>
                  <td className="num">{r.brandsAsking}</td>
                  <td className="num">{r.fittingProperties}</td>
                  <td className="num">{r.brandsPitched}</td>
                  <td>{r.notPitched ? <span style={{ color: 'var(--maroon)', fontWeight: 600 }}>{r.notPitched} brand{r.notPitched === 1 ? '' : 's'}: {r.notPitchedNames.join(', ')}</span> : <span className="muted">None</span>}</td>
                  <td>{r.lastPitch ? fmtDate(r.lastPitch) : '—'}</td>
                  <td>
                    <Link className="btn small" href={`/admin/demand?${new URLSearchParams({ ...(city ? { city } : {}), mm: `${r.city}|${r.microMarket}` })}`}>
                      Open grid
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {grid}
    </main>
  );
}
