import 'server-only';
import type { z } from 'zod';
import type { propertyDraftSchema } from '@/lib/validation';
import type { SettingsDoc } from '@/models';
import { CONDITIONS_NEEDING_DATE, floorsFor, type FloorCount } from '@/lib/constants';
import { ApiError } from '@/lib/http';

type Input = z.output<typeof propertyDraftSchema>;

function finite(n: unknown, max = 1e6): number | null {
  const v = Number(n);
  return Number.isFinite(v) && Math.abs(v) <= max ? Math.round(v * 100) / 100 : null;
}

/** Keeps only well formed floor plan data: sides, turns, diagonals, chosen option and drawing points. */
export function sanitizeFloorPlan(fp: unknown) {
  if (!fp || typeof fp !== 'object') return null;
  const raw = fp as { sameLayout?: unknown; plans?: unknown[] };
  if (!Array.isArray(raw.plans)) return null;
  const plans = raw.plans.slice(0, 5).map((pl) => {
    const p = (pl ?? {}) as Record<string, unknown>;
    const sides = Array.isArray(p.sides)
      ? p.sides.slice(0, 10).map((s) => {
          const x = (s ?? {}) as Record<string, unknown>;
          return { length: finite(x.length, 5000) ?? 0, turn: ['R', 'L', 'A'].includes(String(x.turn)) ? String(x.turn) : 'R', diagonal: finite(x.diagonal, 10000) };
        })
      : [];
    const points = Array.isArray(p.points)
      ? p.points.slice(0, 200).map((pt) => (Array.isArray(pt) ? [finite(pt[0], 1e5) ?? 0, finite(pt[1], 1e5) ?? 0] : [0, 0]))
      : [];
    return {
      floor: String(p.floor ?? 'Ground').slice(0, 20),
      mode: p.mode === 'draw' ? 'draw' : 'sides',
      sides,
      doorSide: Math.max(1, Math.min(10, Math.round(Number(p.doorSide) || 1))),
      option: ['drawn', 'mirror', 'closed', 'unsure'].includes(String(p.option)) ? String(p.option) : null,
      points,
      area: finite(p.area, 1e7),
      gap: finite(p.gap, 1e5),
      adjusted: Array.isArray(p.adjusted) ? p.adjusted.slice(0, 10).map((n) => Math.round(Number(n)) || 0) : [],
    };
  });
  return { sameLayout: raw.sameLayout !== false, plans };
}

/** Applies the location lists and the conditional rules (Broker v2, section 5) before saving. */
export function cleanPropertyInput(d: Input, s: SettingsDoc) {
  const city = s.cities.find((c) => c.enabled && c.name === d.city);
  if (!city) throw new ApiError(422, 'Pick a city from the list', { city: 'Pick a city from the list' });
  const mm = d.microMarket ? city.microMarkets.find((m) => m.name === d.microMarket) : undefined;
  if (d.microMarket && !mm) throw new ApiError(422, 'Pick a micro market from the list', { microMarket: 'Pick a micro market from the list' });
  const stretch = mm && d.stretch && (mm.stretches ?? []).includes(d.stretch) ? d.stretch : '';

  const floors = floorsFor((d.floorCount || '') as FloorCount);
  const floorAreas = floors.map((_, i) => Number(d.floorAreas?.[i] ?? 0) || 0);
  const needsDate = CONDITIONS_NEEDING_DATE.includes(d.condition);

  return {
    city: city.name,
    microMarket: mm?.name ?? '',
    stretch,
    format: d.format,
    address: d.address,
    buildingName: d.buildingName,
    mainRoad: d.mainRoad,
    lat: d.lat,
    lng: d.lng,
    pinLink: d.pinLink,
    chargeableArea: d.chargeableArea,
    carpetArea: d.carpetArea,
    floorCount: d.floorCount,
    floorAreas,
    sameLayout: d.sameLayout,
    ceilingHeight: d.ceilingHeight,
    frontage: d.frontage,
    floorPlan: sanitizeFloorPlan(d.floorPlan),
    rent: d.rent,
    depositMonths: d.depositMonths,
    maintenance: d.maintenance,
    escalation: d.escalation,
    landlordName: d.landlordName,
    dealtWith: d.dealtWith,
    powerKva: d.powerKva,
    powerBackup: d.powerBackup,
    lift: floors.length > 1 ? d.lift : null,
    bikeSlots: d.bikeSlots,
    bikeType: d.bikeType,
    carSlots: d.carSlots,
    carType: d.carType,
    toilets: d.toilets,
    signageSpace: d.signageSpace,
    septicBelow: floors.length === 0 || floors.includes('Ground') ? d.septicBelow : null,
    windows: d.windows,
    electricalBoards: d.electricalBoards,
    condition: d.condition,
    availableDate: needsDate && d.availableDate ? new Date(d.availableDate) : null,
    driveLink: d.driveLink,
    notes: d.notes,
  };
}
