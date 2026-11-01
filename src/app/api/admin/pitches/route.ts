import { connectDB } from '@/lib/db';
import { apiAdmin } from '@/lib/auth';
import { ApiError, handler, ok, parseBody } from '@/lib/http';
import { createPitches } from '@/lib/services/pitching';
import { syncFlagNotifications } from '@/lib/services/jobs';
import { z } from 'zod';

const id = z.string().regex(/^[a-f0-9]{24}$/i);
const schema = z.object({ pairs: z.array(z.object({ propertyId: id, requirementId: id })).min(1).max(50), note: z.string().trim().max(300).optional().default('') });

export const POST = handler(async (req) => {
  await connectDB();
  const s = await apiAdmin();
  const { pairs, note } = await parseBody(req, schema);
  const res = await createPitches(pairs, note, s);
  if (!res.created.length) throw new ApiError(409, `Already pitched: ${res.skipped.join(', ')}`);
  syncFlagNotifications().catch((e) => console.error('[flags]', e));
  return ok(res);
});
