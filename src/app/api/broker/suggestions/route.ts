import { connectDB } from '@/lib/db';
import { apiBroker } from '@/lib/auth';
import { ApiError, handler, ok, parseBody } from '@/lib/http';
import { activity } from '@/lib/services/notify';
import { Property, Requirement, Suggestion } from '@/models';
import { z } from 'zod';

const id = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
const schema = z.object({
  pairs: z.array(z.object({ propertyId: id, requirementId: id })).min(1, 'Pick at least one').max(30),
  note: z.string().trim().max(160, 'Keep the note to one line').optional().default(''),
});

/**
 * A suggestion is a hint, not a match (Broker Skeleton, section 7): own properties only,
 * open requirements only, never the same property twice for the same requirement.
 */
export const POST = handler(async (req) => {
  await connectDB();
  const s = await apiBroker();
  const { pairs, note } = await parseBody(req, schema);
  const props = await Property.find({ _id: { $in: pairs.map((p) => p.propertyId) } }).select('broker state listingStatus code').lean();
  const reqs = await Requirement.find({ _id: { $in: pairs.map((p) => p.requirementId) } }).select('status code microMarket city').lean();
  const pm = new Map(props.map((p) => [String(p._id), p]));
  const rm = new Map(reqs.map((r) => [String(r._id), r]));
  const created: string[] = [];
  const skipped: string[] = [];
  for (const pair of pairs) {
    const p = pm.get(pair.propertyId);
    const r = rm.get(pair.requirementId);
    if (!p || String(p.broker) !== String(s.broker._id)) throw new ApiError(403, 'You can only suggest your own properties.');
    if (p.state !== 'submitted') throw new ApiError(409, `${p.code} is still a draft. Post it first.`);
    if (p.listingStatus !== 'available') throw new ApiError(409, `${p.code} is not an active listing. Mark it available first.`);
    if (!r || r.status !== 'open') throw new ApiError(409, 'That requirement is no longer open.');
    const exists = await Suggestion.findOne({ property: pair.propertyId, requirement: pair.requirementId }).select('_id').lean();
    if (exists) {
      skipped.push(`${p.code} for ${r.code}`);
      continue;
    }
    await Suggestion.create({ property: pair.propertyId, requirement: pair.requirementId, broker: s.broker._id, note });
    created.push(`${p.code} for ${r.code}`);
    await activity(`Suggestion: ${p.code} for ${r.code}`, `${r.microMarket}, ${r.city} · by ${s.broker.fullName}${note ? ` · "${note}"` : ''}`, `/admin/requirements/${pair.requirementId}`);
  }
  if (!created.length && skipped.length) throw new ApiError(409, `Already suggested: ${skipped.join(', ')}`);
  return ok({ created, skipped });
});
