import type { Metadata } from 'next';
import Link from 'next/link';
import { pageAdmin } from '@/lib/auth';
import { getSettings, levelName } from '@/lib/settings';
import { fmtDate } from '@/lib/format';
import { loadBoard, scorecard } from '@/lib/services/board';
import { Avatar } from '@/components/ui/Avatar';
import { LevelChip } from '@/components/ui/Badges';

export const metadata: Metadata = { title: 'Brokers' };

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default async function BrokersPage() {
  await pageAdmin();
  const [b, settings] = await Promise.all([loadBoard(), getSettings()]);
  const rows = scorecard(b).sort((a, c) => c.matchedShare - a.matchedShare || c.uploaded - a.uploaded);
  return (
    <main className="page">
      <h1>Brokers</h1>
      <p className="lead">Scorecard per broker: what they upload, how much of it Abacus can use, and how often their listings go stale. It shows which brokers to invest in.</p>
      {rows.length === 0 ? (
        <div className="empty">
          <b>No brokers yet</b>
          Brokers sign up at /signup.
        </div>
      ) : (
        <div className="tw">
          <table className="t">
            <thead>
              <tr>
                <th>Broker</th>
                <th>City</th>
                <th>Level</th>
                <th className="num">Uploaded</th>
                <th className="num">Active</th>
                <th className="num">Matched</th>
                <th className="num">Reached site visit+</th>
                <th className="num">Closed</th>
                <th className="num">Stale rate</th>
                <th className="num">Suggestions taken</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.broker._id.toString()}>
                  <td>
                    <Link className="row-flex" style={{ gap: 8, textDecoration: 'none', color: 'inherit' }} href={`/admin/brokers/${r.broker._id}`}>
                      <Avatar name={r.broker.fullName} fileId={r.broker.avatarFileId ? String(r.broker.avatarFileId) : null} size={30} />
                      <span>
                        <b>{r.broker.fullName}</b>
                        <div className="muted">
                          @{r.broker.username} · {r.broker.company}
                        </div>
                      </span>
                    </Link>
                    {r.broker.status === 'disabled' && <span className="pill p-no">Disabled</span>}
                  </td>
                  <td>{r.broker.city}</td>
                  <td>
                    <LevelChip level={r.broker.level} name={levelName(settings, r.broker.level)} />
                  </td>
                  <td className="num">{r.uploaded}</td>
                  <td className="num">
                    {r.active}
                    {r.stale > 0 && <div className="small" style={{ color: 'var(--maroon)' }}>{r.stale} stale</div>}
                  </td>
                  <td className="num">{pct(r.matchedShare)}</td>
                  <td className="num">{pct(r.advancedShare)}</td>
                  <td className="num">{r.closed}</td>
                  <td className="num">{r.staleRate.toFixed(1)}</td>
                  <td className="num">
                    {r.suggestionsTaken} of {r.suggestions}
                  </td>
                  <td className="small">{fmtDate(r.broker.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ marginTop: 8 }}>Stale rate: times a listing went 30 days without confirmation, per property uploaded.</p>
    </main>
  );
}
