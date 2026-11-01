import { connectDB } from '@/lib/db';
import { apiAdmin, revokeAllSessions } from '@/lib/auth';
import { ApiError, handler, ok, parseBody, requireId } from '@/lib/http';
import { Broker } from '@/models';
import { z } from 'zod';

export const PATCH = handler(async (req, ctx) => {
  await connectDB();
  await apiAdmin();
  const id = requireId((await ctx.params).id, 'broker');
  const { status } = await parseBody(req, z.object({ status: z.enum(['active', 'disabled']) }));
  const b = await Broker.findByIdAndUpdate(id, { $set: { status } });
  if (!b) throw new ApiError(404, 'Broker not found.');
  if (status === 'disabled') await revokeAllSessions(b._id);
  return ok({ ok: true });
});
