import { connectDB } from '@/lib/db';
import { apiAdmin } from '@/lib/auth';
import { ApiError, handler, ok, parseBody, requireId } from '@/lib/http';
import { activity } from '@/lib/services/notify';
import { DuplicatePair, Property } from '@/models';
import { z } from 'zod';

/** Merge keeps the earlier upload and retires the later one; Keep both clears the flag. */
export const POST = handler(async (req, ctx) => {
  await connectDB();
  const s = await apiAdmin();
  const id = requireId((await ctx.params).id, 'duplicate');
  const { action } = await parseBody(req, z.object({ action: z.enum(['merge', 'keep']) }));
  const pair = await DuplicatePair.findById(id);
  if (!pair) throw new ApiError(404, 'Not found.');
  if (pair.status !== 'pending') throw new ApiError(409, 'Already resolved.');
  if (action === 'merge') {
    const [a, b] = await Promise.all([Property.findById(pair.a), Property.findById(pair.b)]);
    if (!a || !b) throw new ApiError(404, 'One of the properties is missing.');
    b.state = 'merged';
    b.mergedInto = a._id;
    b.stageHistory.push({ stage: 'Not closed', note: `Merged into ${a.code} (earlier upload)`, by: s.admin._id, byName: s.admin.name, at: new Date() });
    await b.save();
    await activity(`Merged ${b.code} into ${a.code}`, `Possible duplicate resolved by ${s.admin.name}`, `/admin/properties/${a._id}`);
  }
  pair.status = action === 'merge' ? 'merged' : 'kept_both';
  pair.resolvedBy = s.admin._id;
  pair.resolvedByName = s.admin.name;
  pair.resolvedAt = new Date();
  await pair.save();
  return ok({ ok: true });
});
