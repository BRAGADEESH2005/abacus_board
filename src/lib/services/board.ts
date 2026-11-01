import 'server-only';
import type { Types } from 'mongoose';
import {
  Brand,
  BrandAsk,
  Broker,
  DismissedMatch,
  DuplicatePair,
  Pitch,
  Property,
  Requirement,
  RequirementPrivate,
  Suggestion,
  type BrandDoc,
  type BrokerDoc,
  type DuplicateDoc,
  type PitchDoc,
  type PropertyDoc,
  type RequirementDoc,
  type RequirementPrivateDoc,
  type SuggestionDoc,
} from '@/models';
import { effectiveStage, evaluateMatch, storeFee, type MatchProp, type MatchReq, type MatchResult } from '@/lib/domain';
import { STAGE_RANK } from '@/lib/constants';

/* The board is small (tens of brokers, hundreds of listings), so admin screens load the
 * working set once per request and compute in memory. Every number on the dashboard,
 * brand pages, demand tracker and pending list comes from the same functions below. */

export type AdminReq = RequirementDoc & {
  id: string;
  priv: RequirementPrivateDoc;
  brand: BrandDoc;
  rentMin: number;
  rentMax: number;
  storesWanted: number;
  fee: number;
  paysNothing: boolean;
};

export type Board = Awaited<ReturnType<typeof loadBoard>>;

const DAY = 86400000;

export async function loadBoard() {
  const [reqs, privs, brands, asks, props, pitches, dismissed, suggestions, brokers, dups] = await Promise.all([
    Requirement.find({}).lean<RequirementDoc[]>(),
    RequirementPrivate.find({}).lean<RequirementPrivateDoc[]>(),
    Brand.find({}).lean<BrandDoc[]>(),
    BrandAsk.find({}).select('brand createdAt code').lean<{ _id: Types.ObjectId; brand: Types.ObjectId; createdAt: Date; code: string }[]>(),
    Property.find({ state: { $in: ['submitted', 'merged'] } }).lean<PropertyDoc[]>(),
    Pitch.find({}).lean<PitchDoc[]>(),
    DismissedMatch.find({}).lean<{ property: Types.ObjectId; requirement: Types.ObjectId }[]>(),
    Suggestion.find({}).lean<SuggestionDoc[]>(),
    Broker.find({}).select('-passwordHash').lean<BrokerDoc[]>(),
    DuplicatePair.find({}).lean<DuplicateDoc[]>(),
  ]);
  const brandById = new Map(brands.map((b) => [b._id.toString(), b]));
  const privByReq = new Map(privs.map((p) => [p.requirement.toString(), p]));
  const adminReqs: AdminReq[] = [];
  for (const r of reqs) {
    const priv = privByReq.get(r._id.toString());
    if (!priv) continue;
    const brand = brandById.get(priv.brand.toString());
    if (!brand) continue;
    adminReqs.push({
      ...r,
      id: r._id.toString(),
      priv,
      brand,
      rentMin: priv.rentMin,
      rentMax: priv.rentMax,
      storesWanted: priv.storesWanted ?? 1,
      fee: priv.fee ?? brand.fee ?? 30,
      paysNothing: Boolean(priv.paysNothing),
    });
  }
  const pitchesByReq = groupBy(pitches, (p) => p.requirement.toString());
  const pitchesByProp = groupBy(pitches, (p) => p.property.toString());
  const pitchKey = new Set(pitches.map((p) => `${p.property}|${p.requirement}`));
  const dismissedKey = new Set(dismissed.map((d) => `${d.property}|${d.requirement}`));
  const brokerById = new Map(brokers.map((b) => [b._id.toString(), b]));
  const propById = new Map(props.map((p) => [p._id.toString(), p]));
  const reqById = new Map(adminReqs.map((r) => [r.id, r]));
  return {
    reqs: adminReqs,
    reqById,
    brands,
    brandById,
    asks,
    props: props.filter((p) => p.state === 'submitted'),
    allProps: props,
    propById,
    pitches,
    pitchesByReq,
    pitchesByProp,
    pitchKey,
    dismissedKey,
    suggestions,
    brokers,
    brokerById,
    dups,
  };
}

function groupBy<T>(arr: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of arr) {
    const k = key(x);
    const list = m.get(k);
    if (list) list.push(x);
    else m.set(k, [x]);
  }
  return m;
}

export function matchReqInput(r: AdminReq): MatchReq {
  return {
    city: r.city,
    microMarket: r.microMarket,
    stretches: r.stretches ?? [],
    stretchCarpet: (r.stretchCarpet ?? []) as MatchReq['stretchCarpet'],
    formats: r.formats ?? [],
    carpetMin: r.carpetMin,
    carpetMax: r.carpetMax,
    floors: r.floors ?? [],
    minCeiling: r.minCeiling,
    minPowerKva: r.minPowerKva,
    minFrontage: r.minFrontage,
    rentMax: r.rentMax,
    stretchRent: (r.priv.stretchRent ?? []) as MatchReq['stretchRent'],
  };
}

export function matchPropInput(p: PropertyDoc): MatchProp {
  return {
    city: p.city,
    microMarket: p.microMarket,
    stretch: p.stretch,
    format: p.format,
    carpetArea: p.carpetArea ?? null,
    floorCount: p.floorCount,
    ceilingHeight: p.ceilingHeight ?? null,
    powerKva: p.powerKva ?? null,
    frontage: p.frontage ?? null,
    rent: p.rent ?? null,
  };
}

/** Listings that can be matched: submitted, available (stale listings drop out until reconfirmed). */
export function matchable(p: PropertyDoc): boolean {
  return p.state === 'submitted' && p.listingStatus === 'available';
}

export function propertyStage(b: Board, p: PropertyDoc) {
  const ps = b.pitchesByProp.get(p._id.toString()) ?? [];
  const sorted = [...ps].sort((x, y) => +new Date(x.createdAt) - +new Date(y.createdAt));
  return effectiveStage(p.adminStage, p.adminStageNote, sorted.map((x) => ({ stage: x.stage, stageNote: x.stageNote })));
}

export type SystemSuggestion = { req: AdminReq; prop: PropertyDoc; result: MatchResult; since: Date };

/** Properties the system thinks fit, not yet pitched or dismissed. */
export function systemSuggestions(b: Board, filter?: { reqId?: string; propId?: string; city?: string }): SystemSuggestion[] {
  const out: SystemSuggestion[] = [];
  const reqs = b.reqs.filter((r) => r.status === 'open' && (!filter?.reqId || r.id === filter.reqId) && (!filter?.city || r.city === filter.city));
  const props = b.props.filter((p) => matchable(p) && (!filter?.propId || p._id.toString() === filter.propId));
  for (const r of reqs) {
    const mr = matchReqInput(r);
    for (const p of props) {
      if (p.city !== r.city || p.microMarket !== r.microMarket) continue;
      const k = `${p._id}|${r._id}`;
      if (b.pitchKey.has(k) || b.dismissedKey.has(k)) continue;
      const result = evaluateMatch(mr, matchPropInput(p));
      if (!result.fits) continue;
      const since = new Date(Math.max(+new Date(r.postedAt ?? r.createdAt), +new Date(p.submittedAt ?? p.createdAt)));
      out.push({ req: r, prop: p, result, since });
    }
  }
  return out.sort((a, b2) => +a.since - +b2.since);
}

/** For "Pitch to requirement" from a property: every active requirement, best fits first. */
export function rankRequirementsForProperty(b: Board, p: PropertyDoc) {
  const mp = matchPropInput(p);
  return b.reqs
    .filter((r) => r.status === 'open')
    .map((r) => ({ req: r, result: evaluateMatch(matchReqInput(r), mp), pitched: b.pitchKey.has(`${p._id}|${r._id}`) }))
    .sort((a, c) => Number(c.result.fits) - Number(a.result.fits) || c.result.score - a.result.score);
}

/* ───────────── Flags (Admin v2, section 8) ───────────── */

export type FlagKind = 'no_option_7' | 'nothing_20' | 'confirm_active';
export const FLAG_LABEL: Record<FlagKind, string> = {
  no_option_7: 'No option shared in 7 days',
  nothing_20: 'Nothing shared in 20 days',
  confirm_active: 'Confirm still active',
};
export type Flag = { kind: FlagKind; req: AdminReq; days: number };

export function computeFlags(b: Board, now = Date.now()): Flag[] {
  const flags: Flag[] = [];
  for (const r of b.reqs) {
    if (r.status !== 'open') continue;
    const posted = +new Date(r.postedAt ?? r.createdAt);
    const age = Math.floor((now - posted) / DAY);
    const ps = b.pitchesByReq.get(r.id) ?? [];
    if (ps.length === 0 && age >= 20) flags.push({ kind: 'nothing_20', req: r, days: age });
    else if (ps.length === 0 && age >= 7) flags.push({ kind: 'no_option_7', req: r, days: age });
    const activeFrom = Math.max(posted, r.stillActiveAt ? +new Date(r.stillActiveAt) : 0);
    const activeAge = Math.floor((now - activeFrom) / DAY);
    const moved = ps.some((p) => (STAGE_RANK[p.stage] ?? 0) > STAGE_RANK.Pitched!);
    if (activeAge >= 20 && !moved) flags.push({ kind: 'confirm_active', req: r, days: activeAge });
  }
  return flags;
}

export function flagsForReq(flags: Flag[], reqId: string) {
  return flags.filter((f) => f.req.id === reqId);
}

/* ───────────── Pipeline and revenue (Admin v2, section 3) ───────────── */

export function rowFee(r: AdminReq) {
  return storeFee(r.rentMin, r.rentMax, r.carpetMin, r.carpetMax, r.fee, r.paysNothing);
}

export function pipeline(b: Board, city?: string) {
  const reqs = b.reqs.filter((r) => !city || r.city === city);
  const open = reqs.filter((r) => r.status === 'open');
  const reqIds = new Set(reqs.map((r) => r.id));
  const pitches = b.pitches.filter((p) => reqIds.has(p.requirement.toString()));
  const byStage = (s: string) => pitches.filter((p) => p.stage === s);
  const pitchesOf = (r: AdminReq) => b.pitchesByReq.get(r.id) ?? [];

  const yetToGive = open.filter((r) => pitchesOf(r).length === 0);
  const awaiting = open.filter((r) => {
    const ps = pitchesOf(r);
    return ps.length > 0 && ps.some((p) => p.stage === 'Pitched') && !ps.some((p) => ['Site visit done', 'Under negotiation', 'Closed'].includes(p.stage));
  });

  let closedRev = 0;
  let negRev = 0;
  let fullRev = 0;
  for (const p of pitches) {
    const r = b.reqById.get(p.requirement.toString());
    if (!r) continue;
    if (p.stage === 'Closed') closedRev += rowFee(r);
    if (p.stage === 'Under negotiation') negRev += rowFee(r);
  }
  for (const r of open) {
    const closedHere = pitchesOf(r).filter((p) => p.stage === 'Closed').length;
    fullRev += rowFee(r) * Math.max(0, r.storesWanted - closedHere);
  }
  return {
    tiles: {
      brands: new Set(open.map((r) => r.brand._id.toString())).size,
      requirements: open.length,
      storesNeeded: open.reduce((s, r) => s + r.storesWanted, 0),
      yetToGive: yetToGive.length,
      awaiting: awaiting.length,
      siteVisit: byStage('Site visit done').length,
      negotiation: byStage('Under negotiation').length,
      closed: byStage('Closed').length,
    },
    revenue: { closed: closedRev, negotiation: negRev, full: fullRev },
    lists: { yetToGive, awaiting },
  };
}

/* ───────────── Weekly target (Monday to Sunday, India time) ───────────── */

const IST_OFFSET = 5.5 * 3600000;

export function istWeekStart(t: number): number {
  const ist = new Date(t + IST_OFFSET);
  const day = (ist.getUTCDay() + 6) % 7; // Monday = 0
  const startIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - day * DAY;
  return startIst - IST_OFFSET;
}

export function weeklyBrands(b: Board, city?: string, weeks = 8, now = Date.now()) {
  // A brand counts in the week of its first requirement.
  const first = new Map<string, number>();
  const reqCitiesByAsk = new Map<string, Set<string>>();
  for (const r of b.reqs) {
    const k = r.priv.brandAsk.toString();
    if (!reqCitiesByAsk.has(k)) reqCitiesByAsk.set(k, new Set());
    reqCitiesByAsk.get(k)!.add(r.city);
  }
  for (const a of b.asks) {
    if (city && !reqCitiesByAsk.get(a._id.toString())?.has(city)) continue;
    const k = a.brand.toString();
    const t = +new Date(a.createdAt);
    if (!first.has(k) || t < first.get(k)!) first.set(k, t);
  }
  const thisWeek = istWeekStart(now);
  const out: { weekStart: number; count: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = thisWeek - i * 7 * DAY;
    const we = ws + 7 * DAY;
    let count = 0;
    for (const t of first.values()) if (t >= ws && t < we) count++;
    out.push({ weekStart: ws, count });
  }
  return out;
}

/* ───────────── Demand tracker (Admin v2, section 5) ───────────── */

export function demand(b: Board, city?: string) {
  const open = b.reqs.filter((r) => r.status === 'open' && (!city || r.city === city));
  const groups = new Map<string, AdminReq[]>();
  for (const r of open) {
    const k = `${r.city}|${r.microMarket}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const rows = [...groups.entries()].map(([k, reqs]) => {
    const [c, mm] = k.split('|') as [string, string];
    const props = b.props.filter((p) => p.city === c && p.microMarket === mm);
    const fitting = new Set<string>();
    const notPitchedBrands = new Set<string>();
    let lastPitch: Date | null = null;
    const pitchedBrands = new Set<string>();
    for (const r of reqs) {
      const mr = matchReqInput(r);
      for (const p of props) {
        const fits = matchable(p) && evaluateMatch(mr, matchPropInput(p)).fits;
        const key = `${p._id}|${r._id}`;
        if (fits) fitting.add(p._id.toString());
        if (fits && !b.pitchKey.has(key) && !b.dismissedKey.has(key)) notPitchedBrands.add(r.brand._id.toString());
      }
      for (const p of b.pitchesByReq.get(r.id) ?? []) {
        pitchedBrands.add(r.brand._id.toString());
        if (!lastPitch || +new Date(p.createdAt) > +lastPitch) lastPitch = new Date(p.createdAt);
      }
    }
    return {
      city: c,
      microMarket: mm,
      brandsAsking: new Set(reqs.map((r) => r.brand._id.toString())).size,
      fittingProperties: fitting.size,
      brandsPitched: pitchedBrands.size,
      notPitched: notPitchedBrands.size,
      notPitchedNames: [...notPitchedBrands].map((id) => b.brandById.get(id)?.name ?? ''),
      lastPitch,
      reqIds: reqs.map((r) => r.id),
    };
  });
  return rows.sort((a, c) => c.notPitched - a.notPitched || c.brandsAsking - a.brandsAsking);
}

/* ───────────── Broker scorecard (Broker Skeleton, section 10.7) ───────────── */

export function scorecard(b: Board) {
  return b.brokers.map((br) => {
    const props = b.props.filter((p) => p.broker.toString() === br._id.toString());
    const pitchedProps = props.filter((p) => (b.pitchesByProp.get(p._id.toString()) ?? []).length > 0);
    const advanced = props.filter((p) => (b.pitchesByProp.get(p._id.toString()) ?? []).some((x) => (STAGE_RANK[x.stage] ?? 0) >= STAGE_RANK['Site visit done']!));
    const closed = props.filter((p) => (b.pitchesByProp.get(p._id.toString()) ?? []).some((x) => x.stage === 'Closed'));
    const staleEvents = props.reduce((s, p) => s + (p.staleCount ?? 0), 0);
    const suggestions = b.suggestions.filter((s) => s.broker.toString() === br._id.toString());
    return {
      broker: br,
      uploaded: props.length,
      active: props.filter((p) => p.listingStatus === 'available').length,
      stale: props.filter((p) => p.listingStatus === 'needs_reconfirm').length,
      matchedShare: props.length ? pitchedProps.length / props.length : 0,
      advancedShare: props.length ? advanced.length / props.length : 0,
      closed: closed.length,
      staleRate: props.length ? staleEvents / props.length : 0,
      suggestions: suggestions.length,
      suggestionsTaken: suggestions.filter((s) => s.status === 'pitched').length,
    };
  });
}
