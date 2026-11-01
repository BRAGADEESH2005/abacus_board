import type { Metadata } from 'next';
import Link from 'next/link';
import { pageAdmin } from '@/lib/auth';
import { computeFlags, loadBoard, pipeline } from '@/lib/services/board';
import { reqView } from '@/lib/services/adminView';
import { FLAG_LABEL } from '@/lib/services/board';
import { inr, sqft } from '@/lib/format';
import { REQUIREMENT_STATUS_LABEL } from '@/lib/constants';
import { CitySelect } from '@/components/admin/actions';
import { StageBadge } from '@/components/ui/Badges';
import { ListFilters } from '@/components/admin/ListFilters';

export const metadata: Metadata = { title: 'Requirements' };

const VIEWS: Record<string, string> = { yet: 'Yet to give options', awaiting: 'Pitched, awaiting reply', suggested: 'With broker suggestions waiting', flagged: 'Red flagged' };

export default async function AdminRequirements({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageAdmin();
  const sp = await searchParams;
  const city = sp.city ?? '';
  const status = sp.status ?? (sp.view ? 'open' : 'open');
  const q = (sp.q ?? '').toLowerCase();
  const b = await loadBoard();
  const flags = computeFlags(b);
  const pl = pipeline(b, city || undefined);
  const yet = new Set(pl.lists.yetToGive.map((r) => r.id));
  const awaiting = new Set(pl.lists.awaiting.map((r) => r.id));
  const suggested = new Set(b.suggestions.filter((s) => s.status === 'pending').map((s) => s.requirement.toString()));
  const flaggedIds = new Set(flags.map((f) => f.req.id));
  const list = b.reqs
    .filter((r) => (status === 'all' || r.status === status) && (!city || r.city === city))
    .filter((r) => !q || r.brand.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.microMarket.toLowerCase().includes(q))
    .filter((r) => {
      switch (sp.view) {
        case 'yet':
          return yet.has(r.id);
        case 'awaiting':
          return awaiting.has(r.id);
        case 'suggested':
          return suggested.has(r.id);
        case 'flagged':
          return flaggedIds.has(r.id);
        default:
          return true;
      }
    })
    .sort((a, c) => +new Date(c.postedAt) - +new Date(a.postedAt))
    .map((r) => reqView(b, r, flags));
  const cities = [...new Set(b.reqs.map((r) => r.city))].sort();

  return (
    <main className="page">
      <div className="pagehead">
        <div>
          <h1>Requirements {sp.view && VIEWS[sp.view] ? <span className="muted">· {VIEWS[sp.view]}</span> : null}</h1>
          <p className="lead">One row per micro market requirement. Exact rent and brand names are admin only.</p>
        </div>
        <Link className="btn primary" href="/admin/requirements/new">
          Post a requirement
        </Link>
      </div>
      <div className="row-flex" style={{ marginBottom: 12 }}>
        <CitySelect cities={cities} value={city} />
        <ListFilters
          fields={[
            { name: 'status', value: status, options: [['open', 'Open'], ['on_hold', 'On hold'], ['closed', 'Closed'], ['all', 'All statuses']] },
            { name: 'view', value: sp.view ?? '', options: [['', 'All'], ...Object.entries(VIEWS)] },
          ]}
          search={{ name: 'q', value: sp.q ?? '', placeholder: 'Brand, code or locality' }}
        />
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <b>No requirements here</b>
          <Link href="/admin/requirements/new">Post a requirement</Link> or clear the filters.
        </div>
      ) : (
        <div className="tw">
          <table className="t">
            <thead>
              <tr>
                <th>Code</th>
                <th>Brand</th>
                <th>Location</th>
                <th className="num">Stores</th>
                <th>Carpet</th>
                <th>Rent (exact)</th>
                <th className="num">Pitched</th>
                <th>Furthest stage</th>
                <th className="num">Days</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className={r.flags.length ? 'red' : ''}>
                  <td>
                    <Link className="mono" href={`/admin/requirements/${r.id}`}>
                      {r.code}
                    </Link>
                    {r.priority === 'high' && <div className="prio">Priority</div>}
                  </td>
                  <td>
                    <Link href={`/admin/brands/${r.brandId}`}>{r.brandName}</Link>
                    <div className="muted">{r.sector}</div>
                  </td>
                  <td>
                    {r.microMarket}, {r.city}
                    {r.stretches.length > 0 && <div className="muted">{r.stretches.join(', ')}</div>}
                  </td>
                  <td className="num">{r.storesWanted}</td>
                  <td>{sqft(r.carpetMin, r.carpetMax)}</td>
                  <td>
                    {inr(r.rentMin)} to {inr(r.rentMax)}
                  </td>
                  <td className="num">{r.pitches}</td>
                  <td>{r.furthest === 'None' ? <span className="muted">None</span> : <StageBadge stage={r.furthest} />}</td>
                  <td className="num">{r.days}</td>
                  <td>
                    {REQUIREMENT_STATUS_LABEL[r.status]}
                    {r.flags.map((f) => (
                      <div key={f.kind} className="kind red" style={{ marginTop: 4, display: 'inline-block' }}>
                        {FLAG_LABEL[f.kind]}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
