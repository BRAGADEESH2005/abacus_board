import { connectDB } from '@/lib/db';
import { apiBroker } from '@/lib/auth';
import { ApiError, handler, ok, requireId } from '@/lib/http';
import { missingRequired } from '@/lib/domain';
import { flagDuplicates } from '@/lib/services/duplicates';
import { activity } from '@/lib/services/notify';
import { computeLevel } from '@/lib/services/levels';
import { brokerProperty, loadOpenRequirements, nearbyRequirements } from '@/lib/services/brokerData';
import { Property, type PropertyDoc } from '@/models';

/** Posts the property: required fields checked, upload time stamped once and never editable. */
export const POST = handler(async (_req, ctx) => {
  await connectDB();
  const s = await apiBroker();
  const id = requireId((await ctx.params).id, 'property');
  const p = await Property.findById(id);
  if (!p || String(p.broker) !== String(s.broker._id)) throw new ApiError(404, 'That property was not found.');
  if (p.state !== 'draft') throw new ApiError(409, 'This property is already posted.');
  const miss = missingRequired(p.toObject() as never);
  if (miss.length) throw new ApiError(422, `Fill the required fields first: ${miss.join(', ')}`, undefined, { missing: miss });
  const now = new Date();
  p.state = 'submitted';
  p.submittedAt = now;
  p.lastConfirmedAt = now;
  p.listingStatus = 'available';
  p.adminStage = 'Received';
  p.stageHistory.push({ stage: 'Received', note: 'Automatic when the broker posts', byName: 'System', at: now });
  await p.save();
  const doc = p.toObject() as PropertyDoc;
  const dups = await flagDuplicates(doc);
  await activity(
    `New broker property: ${p.code}`,
    `${p.microMarket}, ${p.city} · ${p.carpetArea} sq ft · by ${s.broker.fullName}${dups ? ' · possible duplicate' : ''}`,
    `/admin/properties/${p._id}`,
  );
  computeLevel(s.broker).catch((e) => console.error('[level]', e));
  const { requirements } = await loadOpenRequirements();
  const nearby = nearbyRequirements(brokerProperty(doc, []), requirements).map((r) => ({ id: r.id, code: r.code, place: `${r.microMarket}, ${r.city}`, sector: r.sector }));
  return ok({ ok: true, code: p.code, nearby });
});
