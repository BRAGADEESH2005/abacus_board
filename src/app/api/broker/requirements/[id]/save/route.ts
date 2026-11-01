import { connectDB } from '@/lib/db';
import { apiBroker } from '@/lib/auth';
import { ApiError, handler, ok, parseBody, requireId } from '@/lib/http';
import { Requirement, SavedRequirement } from '@/models';
import { z } from 'zod';

export const POST = handler(async (req, ctx) => {
  await connectDB();
  const s = await apiBroker();
  const id = requireId((await ctx.params).id, 'requirement');
  const { saved } = await parseBody(req, z.object({ saved: z.boolean() }));
  const r = await Requirement.findById(id).select('status').lean();
  if (!r) throw new ApiError(404, 'That requirement was not found.');
  if (saved) await SavedRequirement.updateOne({ broker: s.broker._id, requirement: id }, { $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  else await SavedRequirement.deleteOne({ broker: s.broker._id, requirement: id });
  return ok({ saved });
});
