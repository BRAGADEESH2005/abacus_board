import { connectDB } from '@/lib/db';
import { apiAdmin } from '@/lib/auth';
import { handler, ok, parseBody } from '@/lib/http';
import { Notification } from '@/models';
import { z } from 'zod';

/** Each admin marks items read separately. */
export const POST = handler(async (req) => {
  await connectDB();
  const s = await apiAdmin();
  const { ids, all } = await parseBody(req, z.object({ ids: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(500).optional(), all: z.boolean().optional() }));
  const filter = all ? { readBy: { $ne: s.admin._id } } : { _id: { $in: ids ?? [] } };
  await Notification.updateMany(filter, { $addToSet: { readBy: s.admin._id } });
  return ok({ ok: true });
});
