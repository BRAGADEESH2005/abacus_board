import type { Metadata } from 'next';
import Link from 'next/link';
import { pageAdmin } from '@/lib/auth';
import { inrShort } from '@/lib/format';
import { computeFlags, loadBoard, rowFee } from '@/lib/services/board';
import { CitySelect } from '@/components/admin/actions';
import { ListFilters } from '@/components/admin/ListFilters';

export const metadata: Metadata = { title: 'Brands' };

export default async function BrandsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageAdmin();
  const sp = await searchParams;
  const city = sp.city ?? '';
  const q = (sp.q ?? '').toLowerCase();
  const b = await loadBoard();
  const flags = computeFlags(b);
  const rows = b.brands
    .map((br) => {
      const reqs = b.reqs.filter((r) => r.brand._id.toString() === br._id.toString() && (!city || r.city === city));
      const open = reqs.filter((r) => r.status === 'open');
      const withOptions = open.filter((r) => (b.pitchesByReq.get(r.id) ?? []).length > 0).length;
      return {
        br,
        open: open.length,
        stores: open.reduce((s, r) => s + r.storesWanted, 0),
        cities: [...new Set(open.map((r) => r.city))],
        withOptions,
        potential: open.reduce((s, r) => s + rowFee(r) * r.storesWanted, 0),
        flags: flags.filter((f) => f.req.brand._id.toString() === br._id.toString()).length,
        total: reqs.length,
      };
    })
    .filter((x) => (!city || x.total > 0) && (!q || x.br.name.toLowerCase().includes(q)))
    .sort((a, c) => c.open - a.open || a.br.name.localeCompare(c.br.name));
  const cities = [...new Set(b.reqs.map((r) => r.city))].sort();
  return (
    <main className="page">
      <div className="pagehead">
        <div>
          <h1>Brands</h1>
          <p className="lead">Where each brand wants stores, and what Abacus has sent for each.</p>
        </div>
        <Link className="btn primary" href="/admin/requirements/new">
          Post a requirement
        </Link>
      </div>
      <div className="row-flex" style={{ marginBottom: 12 }}>
        <CitySelect cities={cities} value={city} />
        <ListFilters fields={[]} search={{ name: 'q', value: sp.q ?? '', placeholder: 'Search brands' }} />
      </div>
      {rows.length === 0 ? (
        <div className="empty">
          <b>No brands yet</b>
          Brands are added when you post their first requirement.
        </div>
      ) : (
        <div className="tw">
          <table className="t">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Sector</th>
                <th>Cities</th>
                <th className="num">Open locations</th>
                <th className="num">Stores</th>
                <th>Options sent</th>
                <th className="num">Full potential</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.br._id.toString()} className={x.flags ? 'red' : ''}>
                  <td>
                    <Link href={`/admin/brands/${x.br._id}`}>
                      <b>{x.br.name}</b>
                    </Link>
                  </td>
                  <td>{x.br.sector}</td>
                  <td className="small">{x.cities.join(', ') || '—'}</td>
                  <td className="num">{x.open}</td>
                  <td className="num">{x.stores}</td>
                  <td>
                    {x.withOptions} of {x.open}
                  </td>
                  <td className="num">{inrShort(x.potential)}</td>
                  <td>{x.flags ? <span className="kind red">{x.flags}</span> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
