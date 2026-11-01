import 'server-only';
import type { Types } from 'mongoose';
import {
  Pitch,
  Property,
  Requirement,
  RequirementPrivate,
  SavedRequirement,
  Suggestion,
  type PitchDoc,
  type PropertyDoc,
  type RequirementDoc,
  type SuggestionDoc,
} from '@/models';
import { effectiveStage, evaluateMatch } from '@/lib/domain';
import { publicRequirement, type PublicRequirement } from './publicReq';
import { RECONFIRM_DAYS } from '@/lib/constants';

/** What a broker may see of their own property: their fields and one stage name. */
export function brokerProperty(p: PropertyDoc, pitches: PitchDoc[]) {
  const st = effectiveStage(
    p.adminStage,
    p.adminStageNote,
    [...pitches].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)).map((x) => ({ stage: x.stage, stageNote: x.stageNote })),
  );
  return {
    id: p._id.toString(),
    code: p.code,
    state: p.state,
    submittedAt: p.submittedAt ? new Date(p.submittedAt).toISOString() : null,
    createdAt: new Date(p.createdAt).toISOString(),
    city: p.city,
    microMarket: p.microMarket,
    stretch: p.stretch,
    format: p.format,
    address: p.address,
    buildingName: p.buildingName,
    mainRoad: p.mainRoad,
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    pinLink: p.pinLink,
    chargeableArea: p.chargeableArea ?? null,
    carpetArea: p.carpetArea ?? null,
    floorCount: p.floorCount,
    floorAreas: p.floorAreas ?? [],
    sameLayout: p.sameLayout ?? true,
    ceilingHeight: p.ceilingHeight ?? null,
    frontage: p.frontage ?? null,
    floorPlan: p.floorPlan ?? null,
    rent: p.rent ?? null,
    depositMonths: p.depositMonths ?? null,
    maintenance: p.maintenance ?? null,
    escalation: p.escalation,
    landlordName: p.landlordName,
    dealtWith: p.dealtWith,
    goAheadFileId: p.goAheadFileId ? p.goAheadFileId.toString() : null,
    goAheadFileName: p.goAheadFileName ?? '',
    powerKva: p.powerKva ?? null,
    powerBackup: p.powerBackup ?? null,
    lift: p.lift ?? null,
    bikeSlots: p.bikeSlots ?? null,
    bikeType: p.bikeType,
    carSlots: p.carSlots ?? null,
    carType: p.carType,
    toilets: p.toilets,
    signageSpace: p.signageSpace ?? null,
    septicBelow: p.septicBelow ?? null,
    windows: p.windows ?? null,
    electricalBoards: p.electricalBoards ?? null,
    condition: p.condition,
    availableDate: p.availableDate ? new Date(p.availableDate).toISOString().slice(0, 10) : '',
    driveLink: p.driveLink,
    notes: p.notes,
    listingStatus: p.listingStatus,
    lastConfirmedAt: p.lastConfirmedAt ? new Date(p.lastConfirmedAt).toISOString() : null,
    stage: p.state === 'merged' ? 'Not closed' : st.stage,
    stageNote: p.state === 'merged' ? 'Duplicate listing merged by Abacus' : st.note,
    matched: pitches.length > 0,
  };
}
export type BrokerProperty = ReturnType<typeof brokerProperty>;

export async function loadBrokerProperties(brokerId: Types.ObjectId) {
  const props = await Property.find({ broker: brokerId }).sort({ createdAt: -1 }).lean<PropertyDoc[]>();
  const pitches = props.length ? await Pitch.find({ property: { $in: props.map((p) => p._id) } }).select('property stage stageNote createdAt').lean<PitchDoc[]>() : [];
  const byProp = new Map<string, PitchDoc[]>();
  for (const x of pitches) {
    const k = x.property.toString();
    byProp.set(k, [...(byProp.get(k) ?? []), x]);
  }
  return props.map((p) => brokerProperty(p, byProp.get(p._id.toString()) ?? []));
}

/** Open requirements as brokers see them, plus the "brands looking" count per micro market. */
export async function loadOpenRequirements() {
  const reqs = await Requirement.find({ status: 'open' }).sort({ priority: -1, postedAt: -1 }).lean<RequirementDoc[]>();
  const privs = reqs.length
    ? await RequirementPrivate.find({ requirement: { $in: reqs.map((r) => r._id) } }).select('requirement brand').lean<{ requirement: Types.ObjectId; brand: Types.ObjectId }[]>()
    : [];
  const brandOf = new Map(privs.map((p) => [p.requirement.toString(), p.brand.toString()]));
  const demand = new Map<string, { city: string; state: string; microMarket: string; brands: Set<string> }>();
  for (const r of reqs) {
    const k = `${r.city}|${r.microMarket}`;
    if (!demand.has(k)) demand.set(k, { city: r.city, state: r.state, microMarket: r.microMarket, brands: new Set() });
    demand.get(k)!.brands.add(brandOf.get(r._id.toString()) ?? r._id.toString());
  }
  return {
    requirements: reqs.map(publicRequirement),
    // Only counts leave the server, never brand identities.
    demand: [...demand.values()].map((d) => ({ city: d.city, state: d.state, microMarket: d.microMarket, brands: d.brands.size })).sort((a, b) => b.brands - a.brands),
  };
}

export async function savedIds(brokerId: Types.ObjectId): Promise<string[]> {
  const s = await SavedRequirement.find({ broker: brokerId }).select('requirement').lean<{ requirement: Types.ObjectId }[]>();
  return s.map((x) => x.requirement.toString());
}

/** Abacus's response to a suggestion, in broker words. */
export function suggestionResponse(s: { status: string }) {
  return s.status === 'pitched' ? 'Taken forward' : s.status === 'dismissed' ? 'Not taken forward' : 'Waiting for Abacus';
}

export async function loadBrokerSuggestions(brokerId: Types.ObjectId) {
  const list = await Suggestion.find({ broker: brokerId }).sort({ createdAt: -1 }).lean<SuggestionDoc[]>();
  const [props, reqs] = await Promise.all([
    Property.find({ _id: { $in: list.map((s) => s.property) } }).select('code microMarket city').lean<PropertyDoc[]>(),
    Requirement.find({ _id: { $in: list.map((s) => s.requirement) } }).select('code microMarket city status').lean<RequirementDoc[]>(),
  ]);
  const pm = new Map(props.map((p) => [p._id.toString(), p]));
  const rm = new Map(reqs.map((r) => [r._id.toString(), r]));
  return list.map((s) => {
    const p = pm.get(s.property.toString());
    const r = rm.get(s.requirement.toString());
    return {
      id: s._id.toString(),
      propertyId: s.property.toString(),
      propertyCode: p?.code ?? '',
      requirementId: s.requirement.toString(),
      requirementCode: r?.code ?? '',
      requirementPlace: r ? `${r.microMarket}, ${r.city}` : '',
      requirementOpen: r?.status === 'open',
      note: s.note,
      createdAt: new Date(s.createdAt).toISOString(),
      response: suggestionResponse(s),
    };
  });
}
export type BrokerSuggestion = Awaited<ReturnType<typeof loadBrokerSuggestions>>[number];

/** Broker's own active listings for a requirement, nearest match first (Broker Skeleton, section 4). */
export function rankOwnForRequirement(r: PublicRequirement, props: BrokerProperty[]) {
  return props
    .filter((p) => p.state === 'submitted' && p.listingStatus === 'available')
    .map((p) => {
      const res = evaluateMatch(
        { ...r, rentBandMax: r.rentBandMax },
        { city: p.city, microMarket: p.microMarket, stretch: p.stretch, format: p.format, carpetArea: p.carpetArea, floorCount: p.floorCount, ceilingHeight: p.ceilingHeight, powerKva: p.powerKva, frontage: p.frontage, rent: p.rent },
      );
      const sameCity = p.city === r.city;
      const areaOk = p.carpetArea !== null && p.carpetArea >= r.carpetMin && p.carpetArea <= r.carpetMax;
      return { property: p, fit: sameCity && areaOk, sameCity, areaOk, score: (sameCity ? 10 : 0) + (areaOk ? 5 : 0) + (p.microMarket === r.microMarket ? 5 : 0) + res.score };
    })
    .sort((a, b) => b.score - a.score);
}

/** "Nearby requirement" prompt after upload: open requirements in the same city the property fits by area and rent. */
export function nearbyRequirements(p: BrokerProperty, reqs: PublicRequirement[]) {
  return reqs.filter(
    (r) =>
      r.city === p.city &&
      p.carpetArea !== null &&
      p.carpetArea >= r.carpetMin &&
      p.carpetArea <= r.carpetMax &&
      (p.rent === null || p.rent <= r.rentBandMax),
  );
}

export function isStale(p: BrokerProperty) {
  const basis = p.lastConfirmedAt ?? p.submittedAt;
  return Boolean(basis && Date.now() - +new Date(basis) > RECONFIRM_DAYS * 86400000);
}
