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
import { PropertiesRequired, type DemandRow } from '@/components/broker/PropertiesRequired';
import { citiesOf, computeDigest, digestLines } from '@/lib/digest';
import { loadDigestContext } from '@/lib/services/weekly';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function BrokerDashboard() {
  const { broker } = await pageBroker();
  // Everything loads side by side; the weekly summary starts as soon as the requirements are in.
  const openP = loadOpenRequirements();
  const [settings, props, suggestions, open, saved, lvl, ctx] = await Promise.all([
    getSettings(),
    loadBrokerProperties(broker._id),
    loadBrokerSuggestions(broker._id),
    openP,
    savedIds(broker._id),
    computeLevel(broker),
    openP.then((o) => loadDigestContext({ reqs: o.requirements, demand: o.demand })),
  ]);
  const myCities = citiesOf(broker);
  const digest = computeDigest(
    myCities,
    ctx,
    props,
    suggestions.map((s) => ({ requirementId: s.requirementId, taken: s.response === 'Taken forward' })),
  );
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
  // Properties Required: open requirements per state, city and micro market.
  const demandMap = new Map<string, DemandRow>();
  for (const r of reqs) {
    const k = `${r.state}|${r.city}|${r.microMarket}`;
    const row = demandMap.get(k) ?? { state: r.state, city: r.city, microMarket: r.microMarket, count: 0 };
    row.count++;
    demandMap.set(k, row);
  }
  const contributionPct = digest.openInCity ? Math.round((digest.suggestedReqsInCity / digest.openInCity) * 100) : 0;
  const ring = profileCompleteness({ ...broker, avatarFileId: broker.avatarFileId ? String(broker.avatarFileId) : null }, whatsappEnabled());
  const leveledUp = LEVEL_ORDER.indexOf(lvl.level as never) > LEVEL_ORDER.indexOf(broker.levelSeen as never);
  const tiles: { v: number; k: string; href: string; alert?: boolean }[] = [
    { v: counts.open, k: 'Open requirements', href: '/broker/requirements' },
    { v: counts.mine, k: 'In your city', href: '/broker/requirements?mine=1' },
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

      <div className="contrib">
        <p>
          {digest.openInCity ? (
            <>
              You have suggested properties for <b>{digest.suggestedReqsInCity}</b> of the <b>{digest.openInCity}</b> requirements in your city.
            </>
          ) : (
            'There are no open requirements in your city right now.'
          )}
        </p>
        {digest.openInCity > 0 && (
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={contributionPct} aria-label="Your contribution in your city">
            <i style={{ width: `${contributionPct}%` }} />
          </div>
        )}
      </div>

      <section className="panel weekly">
        <div className="ph">
          <h3>Your week</h3>
          <span className="muted small">The same summary is emailed to you every Monday.</span>
        </div>
        <div className="pb">
          <ul>
            {digestLines(digest).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className="nudge" style={{ margin: '10px 0 0' }}>
            <Link href={digest.nudge.href}>{digest.nudge.text}</Link>
          </p>
        </div>
      </section>

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

      <h2>Properties Required</h2>
      <PropertiesRequired rows={[...demandMap.values()]} />
    </main>
  );
}
