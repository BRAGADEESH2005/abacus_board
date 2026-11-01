import 'server-only';
import type { PitchDoc, PropertyDoc } from '@/models';
import { STAGE_RANK } from '@/lib/constants';
import { daysSince } from '@/lib/format';
import { computeFlags, propertyStage, rowFee, type AdminReq, type Board, type Flag } from './board';

/** Plain JSON views for admin client components. */

export function reqView(b: Board, r: AdminReq, flags?: Flag[]) {
  const ps = b.pitchesByReq.get(r.id) ?? [];
  let furthest = 'None';
  for (const p of ps) if ((STAGE_RANK[p.stage] ?? 0) > (STAGE_RANK[furthest] ?? -1)) furthest = p.stage;
  if (ps.length && ps.every((p) => p.stage === 'Not closed')) furthest = 'Not closed';
  const fl = (flags ?? computeFlags(b)).filter((f) => f.req.id === r.id);
  return {
    id: r.id,
    code: r.code,
    brandId: r.brand._id.toString(),
    brandName: r.brand.name,
    askId: r.priv.brandAsk.toString(),
    sector: r.sector,
    city: r.city,
    state: r.state,
    microMarket: r.microMarket,
    stretches: r.stretches ?? [],
    formats: r.formats ?? [],
    carpetMin: r.carpetMin,
    carpetMax: r.carpetMax,
    rentMin: r.rentMin,
    rentMax: r.rentMax,
    rentBandMin: r.rentBandMin,
    rentBandMax: r.rentBandMax,
    storesWanted: r.storesWanted,
    fee: r.fee,
    paysNothing: r.paysNothing,
    priority: r.priority,
    status: r.status,
    postedAt: new Date(r.postedAt ?? r.createdAt).toISOString(),
    days: daysSince(r.postedAt ?? r.createdAt),
    pitches: ps.length,
    furthest,
    revenuePerStore: rowFee(r),
    flags: fl.map((f) => ({ kind: f.kind, days: f.days })),
  };
}
export type ReqView = ReturnType<typeof reqView>;

export function propView(b: Board, p: PropertyDoc) {
  const br = b.brokerById.get(p.broker.toString());
  const st = propertyStage(b, p);
  const pitches = b.pitchesByProp.get(p._id.toString()) ?? [];
  const dup = b.dups.find((d) => d.status === 'pending' && (d.a.toString() === p._id.toString() || d.b.toString() === p._id.toString()));
  return {
    id: p._id.toString(),
    code: p.code,
    state: p.state,
    brokerId: p.broker.toString(),
    brokerName: br?.fullName ?? 'Unknown',
    brokerUsername: br?.username ?? '',
    brokerAvatar: br?.avatarFileId ? br.avatarFileId.toString() : null,
    city: p.city,
    microMarket: p.microMarket,
    stretch: p.stretch,
    format: p.format,
    buildingName: p.buildingName,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    carpetArea: p.carpetArea,
    frontage: p.frontage,
    rent: p.rent,
    floorCount: p.floorCount,
    driveLink: p.driveLink,
    notes: p.notes,
    listingStatus: p.listingStatus,
    submittedAt: p.submittedAt ? new Date(p.submittedAt).toISOString() : null,
    adminStage: p.adminStage,
    stage: p.state === 'merged' ? 'Not closed' : st.stage,
    stageNote: st.note,
    pitchCount: pitches.length,
    pitches: pitches.map((x) => ({ id: x._id.toString(), requirementId: x.requirement.toString(), code: b.reqById.get(x.requirement.toString())?.code ?? '', brand: b.reqById.get(x.requirement.toString())?.brand.name ?? '', stage: x.stage })),
    duplicate: dup ? { id: dup._id.toString(), distanceM: dup.distanceM } : null,
  };
}
export type PropView = ReturnType<typeof propView>;

export function pitchView(b: Board, x: PitchDoc) {
  const p = b.propById.get(x.property.toString());
  const r = b.reqById.get(x.requirement.toString());
  return {
    id: x._id.toString(),
    propertyId: x.property.toString(),
    propertyCode: p?.code ?? '',
    requirementId: x.requirement.toString(),
    requirementCode: r?.code ?? '',
    brandName: r?.brand.name ?? '',
    place: r ? `${r.microMarket}, ${r.city}` : '',
    brokerName: b.brokerById.get(x.broker.toString())?.fullName ?? '',
    stage: x.stage,
    stageNote: x.stageNote,
    note: x.note,
    byName: x.byName ?? '',
    createdAt: new Date(x.createdAt).toISOString(),
    history: (x.history ?? []).map((h) => ({ stage: h.stage, note: h.note ?? '', byName: h.byName ?? '', at: new Date(h.at).toISOString() })),
  };
}
export type PitchView = ReturnType<typeof pitchView>;
