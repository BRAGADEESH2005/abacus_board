import 'server-only';
import { Brand, JobRun, Notification, Pitch, Property } from '@/models';
import { RECONFIRM_DAYS } from '@/lib/constants';
import { istHour } from '@/lib/domain';
import { FLAG_LABEL, computeFlags, loadBoard, type Flag, type FlagKind } from './board';

const DAY = 86400000;
const IST_OFFSET = 5.5 * 3600000;
let lastRun = 0;

export function istDay(t: number): string {
  return new Date(t + IST_OFFSET).toISOString().slice(0, 10);
}

/** Start of the given India date (YYYY-MM-DD) as a UTC timestamp. */
function istDayStart(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`) - IST_OFFSET;
}

async function claim(key: string): Promise<boolean> {
  try {
    await JobRun.create({ _id: key });
    return true;
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return false;
    throw e;
  }
}

/**
 * Runs whatever is due. Called on admin page loads (throttled per process) and by
 * /api/cron/daily for an external scheduler. Every job is idempotent.
 */
export async function runDueJobs(force = false): Promise<{ ran: string[] }> {
  const now = Date.now();
  if (!force && now - lastRun < 5 * 60 * 1000) return { ran: [] };
  lastRun = now;
  const ran: string[] = [];
  const today = istDay(now);

  if (await claim(`reconfirm:${today}`)) {
    await sweepStaleListings(now);
    ran.push('reconfirm');
  }
  await syncFlagNotifications(now);
  ran.push('flags');
  if (istHour(new Date(now)) >= 9 && (await claim(`summary:${today}`))) {
    await dailySummary(istDay(now - DAY));
    ran.push('summary');
  }
  return { ran };
}

/** Monthly "still available?" check: 30 days without confirmation moves a listing to Needs reconfirming. */
export async function sweepStaleListings(now = Date.now()) {
  const cutoff = new Date(now - RECONFIRM_DAYS * DAY);
  const stale = await Property.find({
    state: 'submitted',
    listingStatus: 'available',
    $or: [{ lastConfirmedAt: { $lt: cutoff } }, { lastConfirmedAt: null, submittedAt: { $lt: cutoff } }],
  }).select('_id');
  if (stale.length) {
    await Property.updateMany({ _id: { $in: stale.map((s) => s._id) } }, { $set: { listingStatus: 'needs_reconfirm' }, $inc: { staleCount: 1 } });
  }
  return stale.length;
}

/** Red flags into the bell, one grouped line per brand, flag type and posting day. */
export async function syncFlagNotifications(now = Date.now()) {
  const b = await loadBoard();
  const flags = computeFlags(b, now);
  const groups = new Map<string, Flag[]>();
  for (const f of flags) {
    const basis = f.kind === 'confirm_active' ? Math.max(+new Date(f.req.postedAt ?? f.req.createdAt), f.req.stillActiveAt ? +new Date(f.req.stillActiveAt) : 0) : +new Date(f.req.postedAt ?? f.req.createdAt);
    const key = `flag:${f.kind}:${f.req.brand._id}:${istDay(basis)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  const openKeys = new Set(groups.keys());
  for (const [key, list] of groups) {
    const brand = list[0]!.req.brand;
    const kind = list[0]!.kind as FlagKind;
    const cities = [...new Set(list.map((f) => `${f.req.microMarket}, ${f.req.city}`))];
    const title =
      list.length === 1
        ? `${brand.name}: ${FLAG_LABEL[kind]} (${cities[0]})`
        : `${brand.name}: ${list.length} locations, ${FLAG_LABEL[kind].toLowerCase()}`;
    const body = list.map((f) => `${f.req.code} ${f.req.microMarket}, ${f.req.city} · ${f.days} days`).join('\n');
    const existing = await Notification.findOne({ key });
    if (!existing) {
      await Notification.create({ kind: 'flag', key, title, body, link: `/admin/brands/${brand._id}`, data: { flagKind: kind, reqIds: list.map((f) => f.req.id) } });
    } else if (existing.resolvedAt || existing.title !== title || existing.body !== body) {
      const reopened = Boolean(existing.resolvedAt);
      existing.title = title;
      existing.body = body;
      existing.resolvedAt = null;
      existing.data = { flagKind: kind, reqIds: list.map((f) => f.req.id) };
      if (reopened) existing.readBy = [];
      await existing.save();
    }
  }
  await Notification.updateMany({ kind: 'flag', resolvedAt: null, key: { $nin: [...openKeys] } }, { $set: { resolvedAt: new Date(now) } });
  return flags.length;
}

/** Yesterday's numbers as one card in the bell (Admin v2, section 8). No emails. */
export async function dailySummary(day: string) {
  const from = new Date(istDayStart(day));
  const to = new Date(istDayStart(day) + DAY);
  const inWin = { $gte: from, $lt: to };
  const [added, shortlistedAgg, pitches, visitsAgg, closingsAgg, newBrands, openFlags] = await Promise.all([
    Property.countDocuments({ state: { $in: ['submitted', 'merged'] }, submittedAt: inWin }),
    Property.countDocuments({ stageHistory: { $elemMatch: { stage: 'Shortlisted', at: inWin } } }),
    Pitch.countDocuments({ createdAt: inWin }),
    Pitch.countDocuments({ history: { $elemMatch: { stage: 'Site visit done', at: inWin } } }),
    Pitch.countDocuments({ history: { $elemMatch: { stage: 'Closed', at: inWin } } }),
    Brand.countDocuments({ createdAt: inWin }),
    Notification.countDocuments({ kind: 'flag', resolvedAt: null }),
  ]);
  const data = { day, added, shortlisted: shortlistedAgg, pitches, siteVisits: visitsAgg, closings: closingsAgg, newBrands, openFlags };
  const label = new Date(istDayStart(day) + IST_OFFSET).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  await Notification.updateOne(
    { key: `summary:${day}` },
    {
      $setOnInsert: {
        kind: 'summary',
        key: `summary:${day}`,
        title: `Daily summary for ${label}`,
        body: `${added} properties added · ${shortlistedAgg} shortlisted · ${pitches} pitches · ${visitsAgg} site visits · ${closingsAgg} closings · ${newBrands} new brands · ${openFlags} open red flags`,
        data,
        readBy: [],
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  return data;
}
