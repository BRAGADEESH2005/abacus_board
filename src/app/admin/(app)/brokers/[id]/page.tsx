import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageAdmin } from '@/lib/auth';
import { isId } from '@/lib/http';
import { getSettings, levelName } from '@/lib/settings';
import { displayPhone, fmtDate, inr, num } from '@/lib/format';
import { loadBoard, propertyStage, scorecard } from '@/lib/services/board';
import { Property } from '@/models';
import { Avatar } from '@/components/ui/Avatar';
import { LevelChip, ListingBadge, StageBadge } from '@/components/ui/Badges';
import { BrokerStatusToggle } from '@/components/admin/BrokerStatusToggle';

export const metadata: Metadata = { title: 'Broker' };

export default async function BrokerPage({ params }: { params: Promise<{ id: string }> }) {
  await pageAdmin();
  const { id } = await params;
  if (!isId(id)) notFound();
  const [b, settings] = await Promise.all([loadBoard(), getSettings()]);
  const br = b.brokerById.get(id);
  if (!br) notFound();
  const sc = scorecard(b).find((x) => x.broker._id.toString() === id)!;
  const props = b.allProps.filter((p) => p.broker.toString() === id).sort((a, c) => +new Date(c.submittedAt ?? 0) - +new Date(a.submittedAt ?? 0));
  const drafts = await Property.countDocuments({ broker: br._id, state: 'draft' });
  const sugg = b.suggestions.filter((s) => s.broker.toString() === id).sort((a, c) => +new Date(c.createdAt) - +new Date(a.createdAt));
  return (
    <main className="page">
      <p className="muted" style={{ marginTop: 0 }}>
        <Link href="/admin/brokers">← Brokers</Link>
      </p>
      <div className="pagehead">
        <div className="row-flex" style={{ gap: 14 }}>
          <Avatar name={br.fullName} fileId={br.avatarFileId ? String(br.avatarFileId) : null} size={64} />
          <div>
            <div className="row-flex">
              <h1 style={{ margin: 0 }}>{br.fullName}</h1>
              <LevelChip level={br.level} name={levelName(settings, br.level)} />
              {br.status === 'disabled' && <span className="pill p-no">Disabled</span>}
            </div>
            <div className="muted">
              @{br.username} · {br.company} · based in {br.city} · member since {fmtDate(br.createdAt)}
            </div>
            <div className="small">
              <a href={`tel:${br.phone}`}>{displayPhone(br.phone)}</a> {br.phoneVerified ? <span className="verified">✓</span> : <span className="muted">(unverified)</span>} ·{' '}
              <a href={`mailto:${br.email}`}>{br.email}</a> {br.emailVerified && <span className="verified">✓</span>}
              {br.altPhone ? ` · alt ${displayPhone(br.altPhone)}` : ''}
            </div>
            {br.microMarkets?.length ? <div className="small">Covers: {br.microMarkets.map((m) => `${m.name} (${m.city})`).join(', ')}</div> : null}
          </div>
        </div>
        <BrokerStatusToggle id={id} status={br.status} />
      </div>
      <div className="tiles">
        <div className="tile">
          <span className="v">{sc.uploaded}</span>
          <span className="k">Uploaded</span>
        </div>
        <div className="tile">
          <span className="v">{sc.active}</span>
          <span className="k">Active</span>
        </div>
        <div className="tile">
          <span className="v">{Math.round(sc.matchedShare * 100)}%</span>
          <span className="k">Matched</span>
        </div>
        <div className="tile">
          <span className="v">{sc.closed}</span>
          <span className="k">Closed</span>
        </div>
        <div className={`tile ${sc.stale ? 'alert' : ''}`}>
          <span className="v">{sc.stale}</span>
          <span className="k">Need reconfirming</span>
        </div>
        <div className="tile">
          <span className="v">{drafts}</span>
          <span className="k">Unfinished drafts</span>
        </div>
      </div>
      <h2>Properties</h2>
      {props.length === 0 ? (
        <div className="empty">
          <b>No posted properties</b>
        </div>
      ) : (
        <div className="tw">
          <table className="t">
            <thead>
              <tr>
                <th>Code</th>
                <th>Location</th>
                <th className="num">Carpet</th>
                <th className="num">Rent</th>
                <th>Stage</th>
                <th>Listing</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {props.map((p) => (
                <tr key={p._id.toString()}>
                  <td>
                    <Link className="mono" href={`/admin/properties/${p._id}`}>
                      {p.code}
                    </Link>
                  </td>
                  <td>
                    {p.microMarket}, {p.city}
                  </td>
                  <td className="num">{num(p.carpetArea)}</td>
                  <td className="num">{inr(p.rent)}</td>
                  <td>{p.state === 'merged' ? <span className="pill p-no">Merged</span> : <StageBadge stage={propertyStage(b, p).stage} />}</td>
                  <td>
                    <ListingBadge status={p.listingStatus} />
                  </td>
                  <td className="small">{fmtDate(p.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2>Suggestions ({sugg.length})</h2>
      {sugg.length === 0 ? (
        <p className="muted">None yet.</p>
      ) : (
        <div className="tw">
          <table className="t">
            <thead>
              <tr>
                <th>Property</th>
                <th>Requirement</th>
                <th>Date</th>
                <th>Note</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sugg.map((s) => (
                <tr key={s._id.toString()}>
                  <td className="mono">{b.propById.get(s.property.toString())?.code}</td>
                  <td>
                    <Link className="mono" href={`/admin/requirements/${s.requirement}`}>
                      {b.reqById.get(s.requirement.toString())?.code}
                    </Link>{' '}
                    {b.reqById.get(s.requirement.toString())?.brand.name}
                  </td>
                  <td>{fmtDate(s.createdAt)}</td>
                  <td className="small">{s.note || '—'}</td>
                  <td>{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
