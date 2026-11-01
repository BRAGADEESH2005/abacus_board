import 'server-only';
import { Broker, Pitch, Property, type BrokerDoc, type PropertyDoc } from '@/models';
import { missingRequired } from '@/lib/domain';
import { whatsappEnabled } from '@/lib/env';
import { getSettings } from '@/lib/settings';

export const LEVEL_ORDER = ['scout', 'pro', 'partner', 'elite'] as const;

export function hasFloorPlan(p: PropertyDoc): boolean {
  const fp = p.floorPlan as { plans?: { points?: unknown[]; option?: string }[] } | null;
  return Boolean(fp?.plans?.length && fp.plans.every((pl) => Array.isArray(pl.points) && pl.points.length >= 3 && pl.option && pl.option !== 'unsure'));
}

/** Broker level from quality, not volume (Broker v2, section 3b). Thresholds are editable in Settings. */
export async function computeLevel(broker: BrokerDoc) {
  const s = await getSettings();
  const th = (k: string, d: number) => s.levels.find((l) => l.key === k)?.threshold ?? d;
  const props = await Property.find({ broker: broker._id, state: 'submitted' }).lean<PropertyDoc[]>();
  const complete = props.filter((p) => missingRequired(p as never).length === 0 && p.lat != null && hasFloorPlan(p)).length;
  const ids = props.map((p) => p._id);
  const pitches = ids.length ? await Pitch.find({ property: { $in: ids } }).select('property stage').lean<{ property: unknown; stage: string }[]>() : [];
  const matched = new Set(pitches.map((p) => String(p.property))).size;
  const closed = pitches.filter((p) => p.stage === 'Closed').length;
  const verified = broker.emailVerified && (broker.phoneVerified || !whatsappEnabled());
  let level: string = 'scout';
  if (verified && complete >= th('pro', 5)) level = 'pro';
  if (verified && matched >= th('partner', 1)) level = 'partner';
  if (verified && closed >= th('elite', 1)) level = 'elite';
  if (level !== broker.level) await Broker.updateOne({ _id: broker._id }, { $set: { level } });
  return { level, complete, matched, closed, verified };
}
