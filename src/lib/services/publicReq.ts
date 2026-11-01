import 'server-only';
import type { RequirementDoc } from '@/models';

/** The only shape of a requirement that ever leaves the server for a broker. Explicit allow list. */
export function publicRequirement(r: RequirementDoc) {
  return {
    id: r._id.toString(),
    code: r.code,
    sector: r.sector,
    city: r.city,
    state: r.state,
    microMarket: r.microMarket,
    stretches: r.stretches ?? [],
    stretchCarpet: (r.stretchCarpet ?? []).map((s) => ({ stretch: s.stretch ?? '', carpetMin: s.carpetMin ?? 0, carpetMax: s.carpetMax ?? 0 })),
    formats: r.formats ?? [],
    carpetMin: r.carpetMin,
    carpetMax: r.carpetMax,
    rentBandMin: r.rentBandMin,
    rentBandMax: r.rentBandMax,
    minFrontage: r.minFrontage ?? null,
    floors: r.floors ?? [],
    minCeiling: r.minCeiling ?? null,
    minPowerKva: r.minPowerKva ?? null,
    conditionAccepted: r.conditionAccepted ?? '',
    parkingCars: r.parkingCars ?? null,
    parkingBikes: r.parkingBikes ?? null,
    signage: r.signage ?? '',
    otherSpecs: r.otherSpecs ?? '',
    maxDepositMonths: r.maxDepositMonths ?? null,
    leaseYears: r.leaseYears ?? null,
    lockInYears: r.lockInYears ?? null,
    paysNothingNotice: Boolean(r.paysNothingNotice),
    priority: r.priority,
    status: r.status,
    postedAt: (r.postedAt ?? r.createdAt).toISOString(),
  };
}
export type PublicRequirement = ReturnType<typeof publicRequirement>;
