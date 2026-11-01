import { connectDB } from '@/lib/db';
import { apiAdmin } from '@/lib/auth';
import { handler, ok, parseBody } from '@/lib/http';
import { dismissMatch } from '@/lib/services/pitching';
import { z } from 'zod';

const id = z.string().regex(/^[a-f0-9]{24}$/i);

/** Dismissed suggestions do not come back. Also answers a broker suggestion as Not taken forward. */
export const POST = handler(async (req) => {
  await connectDB();
  const s = await apiAdmin();
  const { propertyId, requirementId } = await parseBody(req, z.object({ propertyId: id, requirementId: id }));
  await dismissMatch(propertyId, requirementId, s);
  return ok({ ok: true });
});
