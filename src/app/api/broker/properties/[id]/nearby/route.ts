import { connectDB } from '@/lib/db';
import { apiBroker } from '@/lib/auth';
import { ApiError, handler, ok, requireId } from '@/lib/http';
import { brokerProperty, loadOpenRequirements, nearbyRequirements } from '@/lib/services/brokerData';
import { Property, Suggestion, type PropertyDoc } from '@/models';

export const GET = handler(async (_req, ctx) => {
  await connectDB();
  const s = await apiBroker();
  const id = requireId((await ctx.params).id, 'property');
  const p = await Property.findById(id).lean<PropertyDoc>();
  if (!p || String(p.broker) !== String(s.broker._id)) throw new ApiError(404, 'That property was not found.');
  const { requirements } = await loadOpenRequirements();
  const done = new Set((await Suggestion.find({ property: p._id }).select('requirement').lean()).map((x) => String(x.requirement)));
  const list = nearbyRequirements(brokerProperty(p, []), requirements).filter((r) => !done.has(r.id));
  return ok({ nearby: list.map((r) => ({ id: r.id, code: r.code, place: `${r.microMarket}, ${r.city}`, sector: r.sector })) });
});
