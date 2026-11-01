// Pure domain rules, safe to import from client and server code.
import { CONDITIONS_NEEDING_DATE, STAGE_RANK, floorsFor, type FloorCount } from './constants';
import { num, rentRange, sqft } from './format';

/* ───────────── Rent band ─────────────
 * Admin Side Changes v2, field 8: realtors see a range, never the exact budget.
 * The band starts about 10% below the brand's minimum (rounded down to ₹10) and
 * ends at the brand's maximum rounded to the nearest ₹10, so brokers are not
 * invited to pitch above budget but cannot read the exact numbers either. */
export function rentBand(min: number, max: number): { min: number; max: number } {
  const lo = Math.max(0, Math.floor((min * 0.9) / 10) * 10);
  const hi = Math.max(lo + 10, Math.round(max / 10) * 10);
  return { min: lo, max: hi };
}

/* ───────────── Greeting (Broker Side Changes v2, section 3) ─────────────
 * One list, easy to edit. {name} is the first name. Hours are India time. */
export const GREETING_LINES: { from: number; to: number; lines: string[] }[] = [
  { from: 5, to: 9, lines: ['Good morning, {name}. Early start today.', 'Good morning, {name}. Up with the shutters.'] },
  { from: 9, to: 12, lines: ['Good morning, {name}.', "Morning, {name}. Let's find some spaces."] },
  { from: 12, to: 16, lines: ['Good afternoon, {name}.', 'Good afternoon, {name}. Hope the site visits are going well.'] },
  { from: 16, to: 20, lines: ['Good evening, {name}.', 'Good evening, {name}. Any new spaces today?'] },
  { from: 20, to: 24, lines: ['Good evening, {name}. Wrapping up the day?', 'Good evening, {name}.'] },
  { from: 0, to: 5, lines: ['Working late, {name}?'] },
];

export function istHour(d = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(d));
}

export function greeting(firstName: string, d = new Date(), rand = Math.random()): string {
  const h = istHour(d);
  const slot = GREETING_LINES.find((s) => h >= s.from && h < s.to) ?? GREETING_LINES[0]!;
  const line = slot.lines[Math.floor(rand * slot.lines.length) % slot.lines.length]!;
  return line.replace('{name}', firstName);
}

/* ───────────── Geo ───────────── */

export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Reads coordinates out of a full Google Maps URL. Short links are resolved on the server first. */
export function coordsFromMapsUrl(url: string): { lat: number; lng: number } | null {
  const u = decodeURIComponent(url);
  const pats = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // place pin (most precise)
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // map centre
    /[?&](?:q|query|ll|destination|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /\/place\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /\/search\/(-?\d+(?:\.\d+)?),\s*\+?(-?\d+(?:\.\d+)?)/,
  ];
  for (const p of pats) {
    const m = p.exec(u);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

/* ───────────── Stages ───────────── */

/** The one stage a broker sees: the furthest across all pitches (Admin v2, section 6). */
export function effectiveStage(
  adminStage: string,
  adminNote: string,
  pitches: { stage: string; stageNote?: string | null }[],
): { stage: string; note: string } {
  if (adminStage === 'Not closed') return { stage: 'Not closed', note: adminNote || '' };
  let best = adminStage || 'Received';
  for (const p of pitches) {
    if (p.stage !== 'Not closed' && (STAGE_RANK[p.stage] ?? 0) > (STAGE_RANK[best] ?? 0)) best = p.stage;
  }
  if (pitches.length > 0 && pitches.every((p) => p.stage === 'Not closed') && (STAGE_RANK[best] ?? 0) <= STAGE_RANK.Pitched!) {
    const last = pitches[pitches.length - 1]!;
    return { stage: 'Not closed', note: last.stageNote || '' };
  }
  return { stage: best, note: '' };
}

export function stageClass(stage: string): string {
  switch (stage) {
    case 'Received':
      return 'p-wait';
    case 'Under review':
    case 'Shortlisted':
      return 'p-match';
    case 'Pitched':
    case 'Site visit done':
    case 'Under negotiation':
      return 'p-prop';
    case 'Closed':
      return 'p-won';
    default:
      return 'p-no';
  }
}

/* ───────────── Matching (Admin v2, section 5) ───────────── */

export type MatchReq = {
  city: string;
  microMarket: string;
  stretches: string[];
  stretchCarpet?: { stretch: string; carpetMin: number; carpetMax: number }[];
  formats: string[];
  carpetMin: number;
  carpetMax: number;
  floors: string[];
  minCeiling?: number | null;
  minPowerKva?: number | null;
  minFrontage?: number | null;
  rentMax?: number | null; // admin only: exact budget
  stretchRent?: { stretch: string; rentMin: number; rentMax: number }[];
  rentBandMax?: number | null; // broker side: band
};

export type MatchProp = {
  city: string;
  microMarket: string;
  stretch?: string | null;
  format: string;
  carpetArea: number | null;
  floorCount: string;
  ceilingHeight: number | null;
  powerKva: number | null;
  frontage: number | null;
  rent: number | null;
};

export type MatchCheck = { key: string; label: string; pass: boolean; soft?: boolean };
export type MatchResult = { fits: boolean; checks: MatchCheck[]; tags: string[]; score: number };

export function propertyFloorNames(floorCount: string): string[] {
  return floorsFor(floorCount as FloorCount);
}

export function floorFits(prefs: string[], floorCount: string): boolean {
  if (!prefs || prefs.length === 0 || prefs.includes('Any')) return true;
  const have = propertyFloorNames(floorCount);
  return have.some((f) => prefs.includes(f) || (prefs.includes('Third and above') && ['Third', 'Fourth'].includes(f)));
}

export function evaluateMatch(r: MatchReq, p: MatchProp): MatchResult {
  const named = (r.stretches ?? []).filter(Boolean);
  const stretchOk = named.length === 0 || (!!p.stretch && named.includes(p.stretch));
  const sc = p.stretch ? r.stretchCarpet?.find((s) => s.stretch === p.stretch) : undefined;
  const cMin = sc?.carpetMin ?? r.carpetMin;
  const cMax = sc?.carpetMax ?? r.carpetMax;
  const sr = p.stretch ? r.stretchRent?.find((s) => s.stretch === p.stretch) : undefined;
  const rMax = sr?.rentMax ?? r.rentMax ?? r.rentBandMax ?? null;

  const checks: MatchCheck[] = [
    { key: 'mm', label: named.length ? 'Same micro market and stretch' : 'Same micro market', pass: p.city === r.city && p.microMarket === r.microMarket && stretchOk },
    { key: 'format', label: 'Format the brand ticked', pass: !r.formats?.length || r.formats.includes(p.format) },
    { key: 'carpet', label: `Carpet area ${sqft(cMin, cMax)}`, pass: p.carpetArea !== null && p.carpetArea >= cMin && p.carpetArea <= cMax },
    { key: 'floor', label: 'Preferred floor', pass: floorFits(r.floors, p.floorCount) },
    { key: 'ceiling', label: r.minCeiling ? `Ceiling ${r.minCeiling} ft or more` : 'Ceiling height', pass: !r.minCeiling || (p.ceilingHeight ?? 0) >= r.minCeiling },
    { key: 'power', label: r.minPowerKva ? `Power ${r.minPowerKva} kVA or more` : 'Power', pass: !r.minPowerKva || (p.powerKva ?? 0) >= r.minPowerKva },
  ];
  const tags: string[] = [];
  const rentOk = rMax === null || p.rent === null || p.rent <= rMax;
  checks.push({ key: 'rent', label: 'Rent within budget', pass: rentOk, soft: true });
  if (!rentOk) tags.push('Rent above budget');
  const frontOk = !r.minFrontage || (p.frontage ?? 0) >= r.minFrontage;
  checks.push({ key: 'frontage', label: r.minFrontage ? `Frontage ${r.minFrontage} ft or more` : 'Frontage', pass: frontOk, soft: true });
  if (!frontOk) tags.push('Frontage below minimum');

  const hard = checks.filter((c) => !c.soft);
  const fits = hard.every((c) => c.pass);
  const score = checks.reduce((s, c) => s + (c.pass ? (c.soft ? 1 : 3) : 0), 0) + (p.city === r.city ? 2 : 0);
  return { fits, checks, tags, score };
}

/* ───────────── Property completeness ───────────── */

export type PropertyLike = Record<string, unknown> & {
  floorCount?: string;
  condition?: string;
  lat?: number | null;
  lng?: number | null;
  floorPlan?: unknown;
};

/** Required fields for submitting (Broker v2, section 4), with conditional rules from section 5. */
export function missingRequired(p: PropertyLike): string[] {
  const miss: string[] = [];
  const need = (k: string, label: string) => {
    const v = p[k];
    if (v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))) miss.push(label);
  };
  need('city', 'City');
  need('microMarket', 'Micro market');
  need('format', 'Format');
  need('address', 'Address and landmark');
  if (p.lat === null || p.lat === undefined || p.lng === null || p.lng === undefined) miss.push('Location pin');
  need('chargeableArea', 'Chargeable area');
  need('carpetArea', 'Carpet area');
  need('floorCount', 'Number of floors');
  const floors = floorsFor((p.floorCount ?? '') as FloorCount);
  const areas = (p.floorAreas as number[] | undefined) ?? [];
  if (floors.length && floors.some((_, i) => !areas[i] || areas[i]! <= 0)) miss.push('Carpet area of each floor');
  need('ceilingHeight', 'Ground to ceiling height');
  need('frontage', 'Frontage');
  need('rent', 'Quoted rent');
  need('depositMonths', 'Security deposit');
  need('landlordName', 'Landlord name');
  need('dealtWith', 'Who you dealt with');
  need('powerKva', 'Total power capacity');
  need('powerBackup', 'Power backup');
  if (floors.length > 1) need('lift', 'Lift available');
  need('bikeSlots', 'Bike parking slots');
  need('bikeType', 'Bike parking type');
  need('carSlots', 'Car parking slots');
  need('carType', 'Car parking type');
  need('toilets', 'Toilets');
  need('signageSpace', 'Space for signage board');
  if (floors.includes('Ground')) need('septicBelow', 'Septic or water tank below');
  need('windows', 'Windows inside');
  need('electricalBoards', 'Electrical boards inside');
  need('condition', 'Property status');
  if (p.condition && CONDITIONS_NEEDING_DATE.includes(p.condition)) need('availableDate', 'Expected available date');
  need('driveLink', 'Google Drive folder link');
  return miss;
}

/* ───────────── Copy for WhatsApp (Broker Skeleton, section 4) ───────────── */

export type PublicReqLike = {
  code: string;
  sector: string;
  city: string;
  microMarket: string;
  stretches: string[];
  formats: string[];
  carpetMin: number;
  carpetMax: number;
  rentBandMin: number;
  rentBandMax: number;
  minFrontage?: number | null;
  floors: string[];
  minCeiling?: number | null;
  minPowerKva?: number | null;
  conditionAccepted?: string;
  parkingCars?: number | null;
  parkingBikes?: number | null;
  signage?: string;
  otherSpecs?: string;
  maxDepositMonths?: number | null;
  leaseYears?: number | null;
  lockInYears?: number | null;
  paysNothingNotice?: boolean;
};

export function whatsappText(r: PublicReqLike, url?: string): string {
  const lines = [
    `*Abacus Spaces requirement ${r.code}*`,
    `Location: ${r.microMarket}, ${r.city}${r.stretches.length ? ` (${r.stretches.join(', ')})` : ''}`,
    `Sector: ${r.sector}`,
    `Format: ${r.formats.join(', ') || 'Any'}`,
    `Carpet area: ${sqft(r.carpetMin, r.carpetMax)}`,
    `Rent: ${rentRange(r.rentBandMin, r.rentBandMax)} per month`,
    r.minFrontage ? `Frontage: ${r.minFrontage} ft+` : '',
    `Floor: ${r.floors.join(', ') || 'Any'}`,
    r.minCeiling ? `Ceiling: ${r.minCeiling} ft+` : '',
    r.minPowerKva ? `Power: ${r.minPowerKva} kVA+` : '',
    r.conditionAccepted ? `Condition: ${r.conditionAccepted}` : '',
    r.parkingCars || r.parkingBikes ? `Parking: ${num(r.parkingCars ?? 0)} cars, ${num(r.parkingBikes ?? 0)} two wheelers` : '',
    r.signage ? `Signage: ${r.signage}` : '',
    r.maxDepositMonths ? `Max deposit: ${r.maxDepositMonths} months` : '',
    r.leaseYears ? `Lease: ${r.leaseYears} years${r.lockInYears ? `, lock in ${r.lockInYears} years` : ''}` : '',
    r.otherSpecs ? `Other: ${r.otherSpecs}` : '',
    r.paysNothingNotice ? 'Note: brand pays no commission; commission sharing applies.' : '',
    url ? url : '',
  ];
  return lines.filter(Boolean).join('\n');
}

/* ───────────── Potential revenue (Admin v2, section 3) ───────────── */

export function storeFee(rentMin: number, rentMax: number, carpetMin: number, carpetMax: number, feeDays: number, paysNothing = false): number {
  if (paysNothing) return 0;
  const monthly = ((rentMin + rentMax) / 2) * ((carpetMin + carpetMax) / 2);
  return monthly * (feeDays / 30);
}
