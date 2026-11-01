import { connectDB } from '@/lib/db';
import { apiAdmin } from '@/lib/auth';
import { ApiError, handler, ok, requireId } from '@/lib/http';
import { syncFlagNotifications } from '@/lib/services/jobs';
import { Requirement } from '@/models';

/** Clears the "Confirm still active" flag for another 20 days. */
export const POST = handler(async (_req, ctx) => {
  await connectDB();
  await apiAdmin();
  const id = requireId((await ctx.params).id, 'requirement');
  const r = await Requirement.findByIdAndUpdate(id, { $set: { stillActiveAt: new Date() } });
  if (!r) throw new ApiError(404, 'Requirement not found.');
  await syncFlagNotifications();
  return ok({ ok: true });
});
