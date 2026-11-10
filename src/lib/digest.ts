// Weekly activity summary for each consultant (Consultant Dashboard Changes, section 10).
// Pure logic, no database: the weekly email and the dashboard both build from it.
import { RECONFIRM_DAYS } from './constants';

const DAY = 86400000;
const WEEK = 7 * DAY;

/** The consultant's city (the signup city plus any city of the micro markets they cover). */
export function citiesOf(b: { city: string; microMarkets?: { city: string }[] | null }): Set<string> {
  return new Set([b.city, ...(b.microMarkets ?? []).map((m) => m.city)].filter(Boolean));
}

export type DigestReq = { id: string; city: string; microMarket: string; postedAt: string | Date };
export type DigestProp = { state: string; listingStatus: string; submittedAt: string | Date | null; lastConfirmedAt: string | Date | null };
export type DigestSuggestion = { requirementId: string; taken: boolean };

/** Board wide facts every consultant's summary is built from. Only counts reach the consultant. */
export type DigestContext = {
  reqs: DigestReq[];
  /** Requirement ids that already have a property suggested or pitched by anyone. */
  served: Set<string>;
  /** Brands looking per "city|micro market". */
  brands: Map<string, number>;
};

export type Digest = {
  uploadedTotal: number;
  uploadedWeek: number;
  drafts: number;
  openInCity: number;
  newInCity: number;
  unservedInCity: number;
  suggestionsMade: number;
  suggestionsMatched: number;
  suggestedReqsInCity: number;
  reconfirm: number;
  nudge: { text: string; href: string };
  /** Nothing uploaded in the last 7 days: lead with what is pending. */
  quiet: boolean;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function computeDigest(cities: Set<string>, ctx: DigestContext, props: DigestProp[], suggestions: DigestSuggestion[], now = Date.now()): Digest {
  const weekAgo = now - WEEK;
  const posted = props.filter((p) => p.state !== 'draft');
  const uploadedWeek = posted.filter((p) => p.submittedAt && +new Date(p.submittedAt) >= weekAgo).length;
  const drafts = props.filter((p) => p.state === 'draft').length;
  const reconfirm = posted.filter((p) => {
    if (p.state !== 'submitted') return false;
    if (p.listingStatus === 'needs_reconfirm') return true;
    const basis = p.lastConfirmedAt ?? p.submittedAt;
    return p.listingStatus === 'available' && Boolean(basis) && now - +new Date(basis!) > RECONFIRM_DAYS * DAY;
  }).length;

  const mine = ctx.reqs.filter((r) => cities.has(r.city));
  const mineIds = new Set(mine.map((r) => r.id));
  const unserved = mine.filter((r) => !ctx.served.has(r.id));
  const suggestedReqsInCity = new Set(suggestions.filter((s) => mineIds.has(s.requirementId)).map((s) => s.requirementId)).size;

  // Nudge: the micro market in the consultant's city with the most brands looking and nothing suggested yet.
  const gaps = new Map<string, { city: string; microMarket: string; brands: number }>();
  for (const r of unserved) {
    const k = `${r.city}|${r.microMarket}`;
    const allUnserved = mine.filter((x) => `${x.city}|${x.microMarket}` === k).every((x) => !ctx.served.has(x.id));
    if (allUnserved && !gaps.has(k)) gaps.set(k, { city: r.city, microMarket: r.microMarket, brands: ctx.brands.get(k) ?? 1 });
  }
  const top = [...gaps.values()].sort((a, b) => b.brands - a.brands)[0];
  let nudge: Digest['nudge'];
  if (top) {
    nudge = {
      text: `${top.microMarket} has ${plural(top.brands, 'brand')} looking and no properties yet. Post one now.`,
      href: `/broker/properties/new?city=${encodeURIComponent(top.city)}&mm=${encodeURIComponent(top.microMarket)}`,
    };
  } else if (drafts) {
    nudge = { text: `You have ${plural(drafts, 'draft')} waiting. Finish and post ${drafts === 1 ? 'it' : 'them'} now.`, href: '/broker/properties?filter=drafts' };
  } else if (reconfirm) {
    nudge = { text: `${plural(reconfirm, 'listing')} need${reconfirm === 1 ? 's' : ''} reconfirming. Tap Still available to keep ${reconfirm === 1 ? 'it' : 'them'} in matching.`, href: '/broker/properties?filter=reconfirm' };
  } else if (mine.length) {
    nudge = { text: `${plural(mine.length, 'requirement is', 'requirements are')} open in your city. Suggest a property now.`, href: '/broker/requirements?mine=1' };
  } else {
    nudge = { text: 'Post a property so Abacus can match it as soon as a requirement comes in.', href: '/broker/properties/new' };
  }

  return {
    uploadedTotal: posted.length,
    uploadedWeek,
    drafts,
    openInCity: mine.length,
    newInCity: mine.filter((r) => +new Date(r.postedAt) >= weekAgo).length,
    unservedInCity: unserved.length,
    suggestionsMade: suggestions.length,
    suggestionsMatched: suggestions.filter((s) => s.taken).length,
    suggestedReqsInCity,
    reconfirm,
    nudge,
    quiet: uploadedWeek === 0,
  };
}

/** The summary as plain lines, in the order the email and the dashboard show them. */
export function digestLines(d: Digest): string[] {
  const uploads = `Properties uploaded so far: ${d.uploadedTotal} (${d.uploadedWeek} in the last 7 days)`;
  const pending = [
    `Drafts still pending (not posted): ${d.drafts}`,
    `Listings that need reconfirming (older than 30 days): ${d.reconfirm}`,
    `Requirements in your city with no property suggested yet: ${d.unservedInCity}`,
  ];
  const rest = [
    `Open requirements in your city: ${d.openInCity} (${d.newInCity} new in the last 7 days)`,
    `Your suggestions: ${d.suggestionsMade} made, ${d.suggestionsMatched} matched by Abacus`,
  ];
  // If nothing was uploaded this week, the pending numbers come first.
  return d.quiet ? [...pending, uploads, ...rest] : [uploads, ...rest, ...pending];
}

