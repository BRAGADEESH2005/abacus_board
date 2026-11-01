import { connectDB } from '@/lib/db';
import { apiBroker } from '@/lib/auth';
import { ApiError, handler, ok, parseBody, requireId } from '@/lib/http';
import { propertyDraftSchema } from '@/lib/validation';
import { getSettings } from '@/lib/settings';
import { missingRequired } from '@/lib/domain';
import { removeUpload } from '@/lib/uploads';
import { flagDuplicates } from '@/lib/services/duplicates';
import { Property, Suggestion, Pitch, type PropertyDoc } from '@/models';
import { cleanPropertyInput } from '@/lib/services/propertyInput';

async function own(id: string, brokerId: unknown) {
  const p = await Property.findById(id);
  if (!p || String(p.broker) !== String(brokerId)) throw new ApiError(404, 'That property was not found.');
  return p;
}

/** Save draft (or update a submitted listing; then every required field must stay filled). */
export const PATCH = handler(async (req, ctx) => {
  await connectDB();
  const s = await apiBroker();
  const p = await own(requireId((await ctx.params).id, 'property'), s.broker._id);
  if (p.state === 'merged') throw new ApiError(409, 'This listing was merged by Abacus and can no longer be edited.');
  const input = await parseBody(req, propertyDraftSchema);
  const settings = await getSettings();
  const clean = cleanPropertyInput(input, settings);
  if (p.state === 'submitted') {
    const miss = missingRequired({ ...(p.toObject() as object), ...clean } as never);
    if (miss.length) throw new ApiError(422, `A posted property needs every required field. Missing: ${miss.join(', ')}`);
  }
  const moved = clean.lat !== p.lat || clean.lng !== p.lng;
  p.set(clean);
  await p.save();
  if (p.state === 'submitted' && moved) await flagDuplicates(p.toObject() as PropertyDoc);
  return ok({ ok: true, savedAt: new Date().toISOString() });
});

/** Only unfinished drafts can be deleted; posted listings are kept for the record (mark Withdrawn instead). */
export const DELETE = handler(async (_req, ctx) => {
  await connectDB();
  const s = await apiBroker();
  const p = await own(requireId((await ctx.params).id, 'property'), s.broker._id);
  if (p.state !== 'draft') throw new ApiError(409, 'Posted properties are kept for the record. Mark it Withdrawn instead.');
  const linked = (await Suggestion.countDocuments({ property: p._id })) + (await Pitch.countDocuments({ property: p._id }));
  if (linked) throw new ApiError(409, 'This draft is linked to a requirement and cannot be deleted.');
  await removeUpload(p.goAheadFileId);
  await p.deleteOne();
  return ok({ ok: true });
});
