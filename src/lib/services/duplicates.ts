import 'server-only';
import { DuplicatePair, Property, type PropertyDoc } from '@/models';
import { haversineM } from '@/lib/domain';
import { DUPLICATE_RADIUS_M } from '@/lib/constants';

/**
 * Flags any other listing whose pin is within about 30 m (Broker Skeleton 10.2, Admin v2 3).
 * Only admins see the flag; brokers are never told, so the flag cannot be used to undercut.
 */
export async function flagDuplicates(p: PropertyDoc): Promise<number> {
  if (p.lat == null || p.lng == null) return 0;
  const d = 0.0006; // ~65 m bounding box, refined with haversine below
  const near = await Property.find({
    _id: { $ne: p._id },
    state: 'submitted',
    lat: { $gte: p.lat - d, $lte: p.lat + d },
    lng: { $gte: p.lng - d, $lte: p.lng + d },
  }).lean<PropertyDoc[]>();
  let n = 0;
  for (const q of near) {
    const dist = haversineM(p.lat, p.lng, q.lat!, q.lng!);
    if (dist > DUPLICATE_RADIUS_M) continue;
    const pFirst = +new Date(p.submittedAt ?? p.createdAt) <= +new Date(q.submittedAt ?? q.createdAt);
    const a = pFirst ? p._id : q._id;
    const b = pFirst ? q._id : p._id;
    const exists = await DuplicatePair.findOne({ a, b }).lean();
    if (!exists) {
      await DuplicatePair.create({ a, b, distanceM: Math.round(dist * 10) / 10 });
      n++;
    }
  }
  return n;
}
