import { connectDB } from '@/lib/db';
import { apiAdmin } from '@/lib/auth';
import { handler, ok, parseBody, requireId } from '@/lib/http';
import { setPropertyStage } from '@/lib/services/pitching';
import { z } from 'zod';

export const PATCH = handler(async (req, ctx) => {
  await connectDB();
  const s = await apiAdmin();
  const id = requireId((await ctx.params).id, 'property');
  const { stage, note, pitchId } = await parseBody(req, z.object({ stage: z.string(), note: z.string().trim().max(300).optional().default(''), pitchId: z.string().optional() }));
  await setPropertyStage(id, stage, note, pitchId, s);
  return ok({ ok: true });
});
