import 'server-only';
import type { Types } from 'mongoose';
import { Broker, JobRun, Pitch, Property, RequirementPrivate, Requirement, Suggestion, type BrokerDoc, type RequirementDoc } from '@/models';
import { getEnv } from '@/lib/env';
import { sendWeeklyDigest } from '@/lib/mail';
import { citiesOf, computeDigest, type DigestContext, type DigestProp, type DigestReq, type DigestSuggestion } from '@/lib/digest';

/*
 * Weekly activity summary for each consultant (Consultant Dashboard Changes, section 10).
 * The same numbers go out by email once a week and show on the consultant's dashboard.
 */

const DAY = 86400000;

/** Open requirement ids that already have a property suggested or pitched by anyone. */
export async function servedRequirementIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const [sugReqs, pitchReqs] = await Promise.all([
    Suggestion.distinct('requirement', { requirement: { $in: ids } }),
    Pitch.distinct('requirement', { requirement: { $in: ids } }),
  ]);
  return new Set([...sugReqs, ...pitchReqs].map(String));
}

/** Board wide facts for the summary. The dashboard passes what it has already loaded. */
export async function loadDigestContext(pre?: { reqs: DigestReq[]; demand: { city: string; microMarket: string; brands: number }[] }): Promise<DigestContext> {
  if (pre) {
    return {
      reqs: pre.reqs,
      served: await servedRequirementIds(pre.reqs.map((r) => r.id)),
      brands: new Map(pre.demand.map((d) => [`${d.city}|${d.microMarket}`, d.brands])),
    };
  }
  const open = (await Requirement.find({ status: 'open' }).select('city microMarket postedAt createdAt').lean<RequirementDoc[]>()).map((r) => ({
    id: r._id.toString(),
    city: r.city,
    microMarket: r.microMarket,
    postedAt: r.postedAt ?? r.createdAt,
  }));
  const ids = open.map((r) => r.id);
  const [served, privs] = await Promise.all([
    servedRequirementIds(ids),
    ids.length ? RequirementPrivate.find({ requirement: { $in: ids } }).select('requirement brand').lean<{ requirement: Types.ObjectId; brand: Types.ObjectId }[]>() : Promise.resolve([]),
  ]);
  const brandOf = new Map(privs.map((p) => [String(p.requirement), String(p.brand)]));
  const sets = new Map<string, Set<string>>();
  for (const r of open) {
    const k = `${r.city}|${r.microMarket}`;
    if (!sets.has(k)) sets.set(k, new Set());
    sets.get(k)!.add(brandOf.get(r.id) ?? r.id);
  }
  return { reqs: open, served, brands: new Map([...sets].map(([k, v]) => [k, v.size])) };
}

/** IST Monday 00:00 for the week containing t, as YYYY-MM-DD. Used to send once per week. */
export function istWeekKey(t: number): string {
  const IST = 5.5 * 3600000;
  const ist = new Date(t + IST);
  const day = (ist.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - day * DAY).toISOString().slice(0, 10);
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
 * Emails every active consultant their summary, once per IST week. Each consultant is claimed
 * separately, so a run that stops halfway carries on next time without sending anyone two emails.
 */
export async function sendWeeklyDigests(now = Date.now()): Promise<{ week: string; sent: number; failed: number }> {
  const week = istWeekKey(now);
  if (await JobRun.exists({ _id: `weekly-done:${week}` })) return { week, sent: 0, failed: 0 };
  const brokers = await Broker.find({ status: 'active' }).select('fullName email city microMarkets').lean<BrokerDoc[]>();
  const ids = brokers.map((b) => b._id);
  const [ctx, props, sugs] = await Promise.all([
    loadDigestContext(),
    Property.find({ broker: { $in: ids }, deletedAt: null }).select('broker state listingStatus submittedAt lastConfirmedAt').lean<(DigestProp & { broker: Types.ObjectId })[]>(),
    Suggestion.find({ broker: { $in: ids } }).select('broker requirement status').lean<{ broker: Types.ObjectId; requirement: Types.ObjectId; status: string }[]>(),
  ]);
  const propsBy = new Map<string, DigestProp[]>();
  for (const p of props) propsBy.set(String(p.broker), [...(propsBy.get(String(p.broker)) ?? []), p]);
  const sugsBy = new Map<string, DigestSuggestion[]>();
  for (const s of sugs) sugsBy.set(String(s.broker), [...(sugsBy.get(String(s.broker)) ?? []), { requirementId: String(s.requirement), taken: s.status === 'pitched' }]);

  const app = getEnv().APP_URL;
  let sent = 0;
  let failed = 0;
  const queue = [...brokers];
  const worker = async () => {
    for (let b = queue.shift(); b; b = queue.shift()) {
      const key = `weekly:${week}:${b._id}`;
      if (!(await claim(key))) continue;
      const d = computeDigest(citiesOf(b), ctx, propsBy.get(String(b._id)) ?? [], sugsBy.get(String(b._id)) ?? [], now);
      try {
        await sendWeeklyDigest(b.email, b.fullName.split(' ')[0] ?? b.fullName, d, app);
        sent++;
      } catch (e) {
        failed++;
        console.error('[weekly] failed for', b.email, e);
        await JobRun.deleteOne({ _id: key }).catch(() => null); // try again on the next run
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  if (!failed) await JobRun.create({ _id: `weekly-done:${week}` }).catch(() => null);
  return { week, sent, failed };
}
