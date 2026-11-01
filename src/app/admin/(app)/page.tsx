import type { Metadata } from 'next';
import Link from 'next/link';
import { pageAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { greeting } from '@/lib/domain';
import { daysSince, firstName, fmtDate, inrShort } from '@/lib/format';
import { FLAG_LABEL, computeFlags, loadBoard, pipeline, systemSuggestions, weeklyBrands } from '@/lib/services/board';
import { CitySelect, DismissButton, DuplicateButtons, PitchButton, ReviewButton, StillActiveButton } from '@/components/admin/actions';

export const metadata: Metadata = { title: 'Admin dashboard' };

type Row = { key: string; since: number; red?: boolean; kind: string; title: React.ReactNode; sub: React.ReactNode; action: React.ReactNode };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await pageAdmin();
  const sp = await searchParams;
  const city = sp.city ?? '';
  const [b, settings] = await Promise.all([loadBoard(), getSettings()]);
  const pl = pipeline(b, city || undefined);
  const weeks = weeklyBrands(b, city || undefined);
  const target = settings.weeklyTarget;
  const thisWeek = weeks[weeks.length - 1]!;
  const lastWeek = weeks[weeks.length - 2]!;
  const isMonday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(new Date()) === 'Mon';
  const met = thisWeek.count >= target;
  const flags = computeFlags(b).filter((f) => !city || f.req.city === city);
  const flagged = new Map<string, string>();
  for (const f of flags) if (f.kind !== 'confirm_active') flagged.set(f.req.id, FLAG_LABEL[f.kind]);
  const sugg = systemSuggestions(b, { city: city || undefined });
  const cities = [...new Set(b.reqs.map((r) => r.city).concat(b.props.map((p) => p.city)))].sort();

  const rows: Row[] = [];
  for (const r of pl.lists.yetToGive) {
    const red = flagged.get(r.id);
    rows.push({
      key: `np-${r.id}`,
      since: +new Date(r.postedAt),
      red: Boolean(red),
      kind: red ?? 'Nothing pitched yet',
      title: (
        <>
          <Link href={`/admin/brands/${r.brand._id}`}>{r.brand.name}</Link> · <span className="code">{r.code}</span>
        </>
      ),
      sub: `${r.microMarket}, ${r.city} · waiting ${daysSince(r.postedAt)} days`,
      action: (
        <Link className="btn small primary" href={`/admin/requirements/${r.id}`}>
          Pitch
        </Link>
      ),
    });
  }
  for (const f of flags.filter((x) => x.kind === 'confirm_active')) {
    rows.push({
      key: `ca-${f.req.id}`,
      since: +new Date(f.req.postedAt),
      red: true,
      kind: FLAG_LABEL.confirm_active,
      title: (
        <>
          <Link href={`/admin/brands/${f.req.brand._id}`}>{f.req.brand.name}</Link> · <span className="code">{f.req.code}</span>
        </>
      ),
      sub: `${f.req.microMarket}, ${f.req.city} · ${f.days} days without progress past Pitched`,
      action: (
        <span className="row-flex">
          <StillActiveButton requirementId={f.req.id} />
          <Link className="btn small" href={`/admin/requirements/${f.req.id}`}>
            Update status
          </Link>
        </span>
      ),
    });
  }
  for (const x of sugg) {
    rows.push({
      key: `sg-${x.prop._id}-${x.req.id}`,
      since: +x.since,
      kind: 'System match',
      title: (
        <>
          <Link className="mono" href={`/admin/properties/${x.prop._id}`}>
            {x.prop.code}
          </Link>{' '}
          fits <Link href={`/admin/brands/${x.req.brand._id}`}>{x.req.brand.name}</Link> · <span className="code">{x.req.code}</span>
        </>
      ),
      sub: (
        <>
          {x.req.microMarket}, {x.req.city}
          {x.result.tags.map((t) => (
            <span key={t} className="pill p-match" style={{ marginLeft: 6 }}>
              {t}
            </span>
          ))}
        </>
      ),
      action: (
        <span className="row-flex">
          <PitchButton pairs={[{ propertyId: x.prop._id.toString(), requirementId: x.req.id }]} />
          <DismissButton propertyId={x.prop._id.toString()} requirementId={x.req.id} />
        </span>
      ),
    });
  }
  for (const p of b.props.filter((p) => p.adminStage === 'Received' && (!city || p.city === city))) {
    rows.push({
      key: `rc-${p._id}`,
      since: +new Date(p.submittedAt ?? p.createdAt),
      kind: 'New property',
      title: (
        <>
          <Link className="mono" href={`/admin/properties/${p._id}`}>
            {p.code}
          </Link>{' '}
          by {b.brokerById.get(p.broker.toString())?.fullName ?? 'broker'}
        </>
      ),
      sub: `${p.microMarket}, ${p.city} · ${p.carpetArea} sq ft · still at Received ${daysSince(p.submittedAt)} days`,
      action: <ReviewButton propertyId={p._id.toString()} />,
    });
  }
  for (const d of b.dups.filter((d) => d.status === 'pending')) {
    const a = b.propById.get(d.a.toString());
    const c = b.propById.get(d.b.toString());
    if (!a || !c || (city && a.city !== city)) continue;
    rows.push({
      key: `dp-${d._id}`,
      since: +new Date(d.createdAt),
      red: true,
      kind: 'Possible duplicate',
      title: (
        <>
          <Link className="mono" href={`/admin/properties/${a._id}`}>
            {a.code}
          </Link>{' '}
          and{' '}
          <Link className="mono" href={`/admin/properties/${c._id}`}>
            {c.code}
          </Link>
        </>
      ),
      sub: `Pins ${d.distanceM} m apart · ${b.brokerById.get(a.broker.toString())?.fullName} uploaded ${fmtDate(a.submittedAt)}, ${b.brokerById.get(c.broker.toString())?.fullName} uploaded ${fmtDate(c.submittedAt)}`,
      action: <DuplicateButtons pairId={d._id.toString()} />,
    });
  }
  rows.sort((x, y) => x.since - y.since);

  const tiles = [
    { v: pl.tiles.brands, k: 'Brands with requirements', href: `/admin/brands${city ? `?city=${city}` : ''}` },
    { v: pl.tiles.requirements, k: 'Requirements', href: `/admin/requirements?status=open${city ? `&city=${city}` : ''}` },
    { v: pl.tiles.storesNeeded, k: 'Stores needed', href: `/admin/requirements?status=open${city ? `&city=${city}` : ''}` },
    { v: pl.tiles.yetToGive, k: 'Yet to give options', href: `/admin/requirements?view=yet${city ? `&city=${city}` : ''}`, alert: pl.tiles.yetToGive > 0 },
    { v: pl.tiles.awaiting, k: 'Pitched, awaiting reply', href: `/admin/requirements?view=awaiting${city ? `&city=${city}` : ''}` },
    { v: pl.tiles.siteVisit, k: 'Site visit done', href: `/admin/properties?stage=Site visit done${city ? `&city=${city}` : ''}` },
    { v: pl.tiles.negotiation, k: 'Under negotiation', href: `/admin/properties?stage=Under negotiation${city ? `&city=${city}` : ''}` },
    { v: pl.tiles.closed, k: 'Closed', href: `/admin/properties?stage=Closed${city ? `&city=${city}` : ''}`, good: pl.tiles.closed > 0 },
  ];
  const inv = b.props.filter((p) => !city || p.city === city);
  const weekAgo = Date.now() - 7 * 86400000;
  const invTiles = [
    { v: inv.length, k: 'Properties in inventory', href: `/admin/properties${city ? `?city=${city}` : ''}` },
    { v: inv.filter((p) => +new Date(p.submittedAt ?? 0) >= weekAgo).length, k: 'New this week', href: `/admin/properties?new=1${city ? `&city=${city}` : ''}` },
    { v: b.suggestions.filter((x) => x.status === 'pending' && (!city || b.reqById.get(x.requirement.toString())?.city === city)).length, k: 'Suggestions waiting', href: `/admin/requirements?view=suggested${city ? `&city=${city}` : ''}` },
    { v: b.dups.filter((d) => d.status === 'pending').length, k: 'Possible duplicates', href: '#pending', alert: b.dups.some((d) => d.status === 'pending') },
  ];
  const maxBar = Math.max(target, ...weeks.map((w) => w.count), 1);

  return (
    <main className="page">
      <div className="pagehead">
        <div>
          <h1>{greeting(firstName(s.admin.name))}</h1>
          <p className="lead">The page is the update. Every number opens the list behind it.</p>
        </div>
        <div className="row-flex">
          <CitySelect cities={cities} value={city} />
          <Link className="btn primary" href="/admin/requirements/new">
            Post a requirement
          </Link>
        </div>
      </div>

      <div className={`banner ${met ? 'met' : ''}`}>
        <div>
          {isMonday && (
            <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>
              Last week: {lastWeek.count} of {target}.{' '}
              {lastWeek.count >= target ? 'Target met.' : `Short by ${target - lastWeek.count} brand${target - lastWeek.count === 1 ? '' : 's'}.`}
            </div>
          )}
          <div className="big">
            {thisWeek.count} of {target}
          </div>
          <div className="small">new brands posting requirements this week{met ? ' · target met' : ''}</div>
        </div>
        <div className="bars" aria-label="New brands per week, last 8 weeks">
          {weeks.map((w, i) => (
            <div
              key={w.weekStart}
              className={`${w.count >= target ? 'met' : ''} ${i === weeks.length - 1 ? 'now' : ''}`}
              style={{ height: `${Math.max(4, (w.count / maxBar) * 56)}px` }}
              title={`Week of ${fmtDate(new Date(w.weekStart + 5.5 * 3600000))}: ${w.count}`}
            >
              <span>{w.count}</span>
            </div>
          ))}
        </div>
      </div>

      <h2>Pipeline (stores, not brands)</h2>
      <div className="tiles">
        {tiles.map((t) => (
          <Link key={t.k} href={t.href} className={`tile ${t.alert ? 'alert' : ''} ${t.good ? 'good' : ''}`}>
            <span className="v">{t.v}</span>
            <span className="k">{t.k}</span>
          </Link>
        ))}
      </div>

      <h2>Potential revenue</h2>
      <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="tile money good">
          <span className="v">{inrShort(pl.revenue.closed)}</span>
          <span className="k">Closed</span>
        </div>
        <div className="tile money">
          <span className="v">{inrShort(pl.revenue.negotiation)}</span>
          <span className="k">In negotiation</span>
        </div>
        <div className="tile money">
          <span className="v">{inrShort(pl.revenue.full)}</span>
          <span className="k">Full potential (ceiling)</span>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        Per location: average rent × average carpet area × our fee (15 or 30 days), times stores. Full potential assumes every open store closes.
      </p>

      <h2>Inventory</h2>
      <div className="tiles">
        {invTiles.map((t) => (
          <Link key={t.k} href={t.href} className={`tile ${t.alert ? 'alert' : ''}`}>
            <span className="v">{t.v}</span>
            <span className="k">{t.k}</span>
          </Link>
        ))}
      </div>

      <h2 id="pending">Pending ({rows.length})</h2>
      {rows.length === 0 ? (
        <div className="empty">
          <b>Nothing pending</b>
          Every requirement has options and every new property has been reviewed.
        </div>
      ) : (
        <div className="panel pending">
          {rows.map((r) => (
            <div key={r.key} className={`prow ${r.red ? 'red' : ''}`}>
              <span className={`kind ${r.red ? 'red' : ''}`}>{r.kind}</span>
              <span className="grow">
                <div>{r.title}</div>
                <div className="muted">{r.sub}</div>
              </span>
              {r.action}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
