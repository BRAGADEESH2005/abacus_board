import type { Metadata } from 'next';
import Link from 'next/link';
import { pageAdmin } from '@/lib/auth';
import { loadBoard } from '@/lib/services/board';
import { propView } from '@/lib/services/adminView';
import { fmtDate, inr, num } from '@/lib/format';
import { PROPERTY_STAGES, LISTING_LABEL, type ListingStatus } from '@/lib/constants';
import { CitySelect, PropertyStageSelect } from '@/components/admin/actions';
import { ListFilters } from '@/components/admin/ListFilters';
import { Avatar } from '@/components/ui/Avatar';
import { ListingBadge } from '@/components/ui/Badges';

export const metadata: Metadata = { title: 'Property inventory' };

export default async function Inventory({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageAdmin();
  const sp = await searchParams;
  const b = await loadBoard();
  const city = sp.city ?? '';
  const q = (sp.q ?? '').toLowerCase();
  const n = (k: string) => (sp[k] ? Number(sp[k]) : null);
  const [amin, amax, fmin, rmax] = [n('amin'), n('amax'), n('fmin'), n('rmax')];
  const weekAgo = Date.now() - 7 * 86400000;
  const all = b.props.map((p) => propView(b, p));
  const list = all
    .filter((p) => !city || p.city === city)
    .filter((p) => !sp.mm || p.microMarket === sp.mm)
    .filter((p) => !sp.broker || p.brokerId === sp.broker)
    .filter((p) => !sp.stage || p.stage === sp.stage)
    .filter((p) => !sp.listing || p.listingStatus === sp.listing)
    .filter((p) => !sp.new || +new Date(p.submittedAt ?? 0) >= weekAgo)
    .filter((p) => amin === null || (p.carpetArea ?? 0) >= amin)
    .filter((p) => amax === null || (p.carpetArea ?? 0) <= amax)
    .filter((p) => fmin === null || (p.frontage ?? 0) >= fmin)
    .filter((p) => rmax === null || (p.rent ?? 0) <= rmax)
    .filter((p) => !q || p.code.toLowerCase().includes(q) || (p.address ?? '').toLowerCase().includes(q) || (p.buildingName ?? '').toLowerCase().includes(q))
    .sort((a, c) => +new Date(c.submittedAt ?? 0) - +new Date(a.submittedAt ?? 0));
  const cities = [...new Set(b.props.map((p) => p.city))].sort();
  const mms = [...new Set(b.props.filter((p) => !city || p.city === city).map((p) => p.microMarket))].sort();

  return (
    <main className="page">
      <div className="pagehead">
        <div>
          <h1>Property inventory</h1>
          <p className="lead">Every broker&apos;s posted properties, with who uploaded each one and when. {list.length} of {all.length} shown.</p>
        </div>
        <Link className="btn" href="/admin/map">
          Open the map
        </Link>
      </div>
      <div className="row-flex" style={{ marginBottom: 12 }}>
        <CitySelect cities={cities} value={city} />
        <ListFilters
          fields={[
            { name: 'mm', value: sp.mm ?? '', label: 'Micro market', options: [['', 'All micro markets'], ...mms.map((m) => [m, m] as [string, string])] },
            { name: 'broker', value: sp.broker ?? '', label: 'Broker', options: [['', 'All brokers'], ...b.brokers.map((x) => [x._id.toString(), `${x.fullName} (@${x.username})`] as [string, string])] },
            { name: 'stage', value: sp.stage ?? '', label: 'Stage', options: [['', 'All stages'], ...PROPERTY_STAGES.map((s) => [s, s] as [string, string])] },
            { name: 'listing', value: sp.listing ?? '', label: 'Listing', options: [['', 'Any listing status'], ...Object.entries(LISTING_LABEL)] },
          ]}
          numbers={[
            { name: 'amin', value: sp.amin ?? '', placeholder: 'Min sq ft' },
            { name: 'amax', value: sp.amax ?? '', placeholder: 'Max sq ft' },
            { name: 'fmin', value: sp.fmin ?? '', placeholder: 'Min frontage' },
            { name: 'rmax', value: sp.rmax ?? '', placeholder: 'Max rent' },
          ]}
          search={{ name: 'q', value: sp.q ?? '', placeholder: 'Code, building or address' }}
        />
      </div>
      {list.length === 0 ? (
        <div className="empty">
          <b>No properties match</b>
          {all.length ? 'Clear a filter to see more.' : 'Brokers have not posted any properties yet.'}
        </div>
      ) : (
        <div className="tw">
          <table className="t">
            <thead>
              <tr>
                <th>Code</th>
                <th>Broker</th>
                <th>Location</th>
                <th className="num">Carpet</th>
                <th className="num">Frontage</th>
                <th className="num">Rent</th>
                <th>Stage</th>
                <th>Listing</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className={p.duplicate ? 'red' : ''}>
                  <td>
                    <Link className="mono" href={`/admin/properties/${p.id}`}>
                      {p.code}
                    </Link>
                    {p.duplicate && <div className="kind red" style={{ marginTop: 4, display: 'inline-block' }}>Possible duplicate</div>}
                  </td>
                  <td>
                    <Link className="row-flex" style={{ gap: 6, textDecoration: 'none', color: 'inherit' }} href={`/admin/brokers/${p.brokerId}`}>
                      <Avatar name={p.brokerName} fileId={p.brokerAvatar} size={24} />
                      {p.brokerName}
                    </Link>
                  </td>
                  <td>
                    {p.microMarket}, {p.city}
                    <div className="muted">{p.format}{p.stretch ? ` · ${p.stretch}` : ''}</div>
                  </td>
                  <td className="num">{num(p.carpetArea)}</td>
                  <td className="num">{p.frontage ?? '—'} ft</td>
                  <td className="num">{inr(p.rent)}</td>
                  <td>
                    <PropertyStageSelect propertyId={p.id} stage={p.stage} pitches={p.pitches} />
                  </td>
                  <td>
                    <ListingBadge status={p.listingStatus as ListingStatus} />
                  </td>
                  <td className="small">{fmtDate(p.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
