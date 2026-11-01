import type { Metadata } from 'next';
import Link from 'next/link';
import { pageBroker } from '@/lib/auth';
import { whatsappEnabled } from '@/lib/env';
import { getSettings, levelName } from '@/lib/settings';
import { greeting } from '@/lib/domain';
import { firstName } from '@/lib/format';
import { profileCompleteness } from '@/lib/profile';
import { computeLevel, LEVEL_ORDER } from '@/lib/services/levels';
import { loadBrokerProperties, loadBrokerSuggestions, loadOpenRequirements, savedIds } from '@/lib/services/brokerData';
import { Avatar } from '@/components/ui/Avatar';
import { LevelChip } from '@/components/ui/Badges';
import { Celebration } from '@/components/broker/Celebration';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function BrokerDashboard() {
  const { broker } = await pageBroker();
  const [settings, props, suggestions, open, saved, lvl] = await Promise.all([
    getSettings(),
    loadBrokerProperties(broker._id),
    loadBrokerSuggestions(broker._id),
    loadOpenRequirements(),
    savedIds(broker._id),
    computeLevel(broker),
  ]);
  const myCities = new Set([broker.city, ...(broker.microMarkets ?? []).map((m) => m.city)]);
  const posted = props.filter((p) => p.state !== 'draft');
  const drafts = props.filter((p) => p.state === 'draft');
  const reqs = open.requirements;
  const counts = {
    open: reqs.length,
    mine: reqs.filter((r) => myCities.has(r.city)).length,
    saved: reqs.filter((r) => saved.includes(r.id)).length,
    uploaded: posted.length,
    active: posted.filter((p) => p.state === 'submitted' && p.listingStatus === 'available').length,
    suggestions: suggestions.length,
    matched: posted.filter((p) => p.matched).length,
    reconfirm: posted.filter((p) => p.state === 'submitted' && p.listingStatus === 'needs_reconfirm').length,
  };
  // Where we need properties: state > city > locality, with counts.
  const tree = new Map<string, Map<string, Map<string, number>>>();
  for (const r of reqs) {
    if (!tree.has(r.state)) tree.set(r.state, new Map());
    const c = tree.get(r.state)!;
    if (!c.has(r.city)) c.set(r.city, new Map());
    const l = c.get(r.city)!;
    l.set(r.microMarket, (l.get(r.microMarket) ?? 0) + 1);
  }
  const ring = profileCompleteness({ ...broker, avatarFileId: broker.avatarFileId ? String(broker.avatarFileId) : null }, whatsappEnabled());
  const leveledUp = LEVEL_ORDER.indexOf(lvl.level as never) > LEVEL_ORDER.indexOf(broker.levelSeen as never);
  const tiles: { v: number; k: string; href: string; alert?: boolean }[] = [
    { v: counts.open, k: 'Open requirements', href: '/broker/requirements' },
    { v: counts.mine, k: 'In your cities', href: '/broker/requirements?mine=1' },
    { v: counts.saved, k: 'Saved requirements', href: '/broker/requirements?saved=1' },
    { v: counts.uploaded, k: 'Properties uploaded', href: '/broker/properties' },
    { v: counts.active, k: 'Active listings', href: '/broker/properties?filter=active' },
    { v: counts.suggestions, k: 'Suggestions made', href: '/broker/suggestions' },
    { v: counts.matched, k: 'Matched by Abacus', href: '/broker/properties?filter=matched' },
    { v: counts.reconfirm, k: 'Need reconfirming', href: '/broker/properties?filter=reconfirm', alert: counts.reconfirm > 0 },
  ];

  return (
    <main className="page">
      {leveledUp && <Celebration level={lvl.level} name={levelName(settings, lvl.level)} />}
      <div className="row-flex" style={{ gap: 16, marginBottom: 18, marginTop: leveledUp ? 16 : 0 }}>
        <Link href="/broker/profile" aria-label="Open profile">
          <Avatar name={broker.fullName} fileId={broker.avatarFileId ? String(broker.avatarFileId) : null} size={60} ring={ring.pct} />
        </Link>
        <div className="grow">
          <div className="row-flex">
            <h1 style={{ margin: 0 }}>{greeting(firstName(broker.fullName))}</h1>
            <LevelChip level={lvl.level} name={levelName(settings, lvl.level)} />
          </div>
          <div className="muted">
            {counts.uploaded} properties posted · {counts.suggestions} suggestions · {counts.matched} matched
            {ring.next && (
              <>
                {' · '}
                <Link href="/broker/profile">{ring.next}</Link> ({ring.pct}% complete)
              </>
            )}
          </div>
        </div>
        <Link className="btn primary" href="/broker/properties/new">
          Post a property
        </Link>
      </div>

      <div className="tiles">
        {tiles.map((t) => (
          <Link key={t.k} href={t.href} className={`tile ${t.alert ? 'alert' : ''}`}>
            <span className="v">{t.v}</span>
            <span className="k">{t.k}</span>
          </Link>
        ))}
      </div>

      {drafts.length > 0 && (
        <div className="notice amber" style={{ marginTop: 14 }}>
          You have {drafts.length} unfinished draft{drafts.length === 1 ? '' : 's'}:{' '}
          {drafts.slice(0, 4).map((d, i) => (
            <span key={d.id}>
              {i > 0 && ', '}
              <Link href={`/broker/properties/${d.id}/edit`}>{d.code}</Link>
            </span>
          ))}
          .
        </div>
      )}

      <h2>Where we need properties</h2>
      {tree.size === 0 ? (
        <div className="empty">
          <b>No open requirements right now</b>
          Abacus will email you when a requirement is posted in your cities.
        </div>
      ) : (
        <div className="tree">
          {[...tree.entries()]
            .sort((a, b) => [...b[1].values()].reduce((s, m) => s + [...m.values()].reduce((x, y) => x + y, 0), 0) - [...a[1].values()].reduce((s, m) => s + [...m.values()].reduce((x, y) => x + y, 0), 0))
            .map(([state, cities]) => {
              const stateCount = [...cities.values()].reduce((s, m) => s + [...m.values()].reduce((x, y) => x + y, 0), 0);
              return (
                <details key={state} open>
                  <summary>
                    {state} <span className="count">{stateCount}</span>
                  </summary>
                  {[...cities.entries()].map(([city, locs]) => (
                    <div className="city" key={city}>
                      <b>{city}</b> <span className="count">{[...locs.values()].reduce((x, y) => x + y, 0)}</span>
                      <div className="locs">
                        {[...locs.entries()].map(([loc, c]) => (
                          <Link key={loc} href={`/broker/requirements?city=${encodeURIComponent(city)}&mm=${encodeURIComponent(loc)}`}>
                            {loc} ({c})
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </details>
              );
            })}
        </div>
      )}
    </main>
  );
}
