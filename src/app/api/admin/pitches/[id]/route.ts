import { connectDB } from '@/lib/db';
import { apiAdmin } from '@/lib/auth';
import { ApiError, handler, ok, parseBody, requireId } from '@/lib/http';
import { setPitchStage } from '@/lib/services/pitching';
import { syncFlagNotifications } from '@/lib/services/jobs';
import { Pitch, Property } from '@/models';
import { z } from 'zod';

export const PATCH = handler(async (req, ctx) => {
  await connectDB();
  const s = await apiAdmin();
  const id = requireId((await ctx.params).id, 'pitch');
  const { stage, note } = await parseBody(req, z.object({ stage: z.string(), note: z.string().trim().max(300).optional().default('') }));
  await setPitchStage(id, stage, note, s);
  syncFlagNotifications().catch((e) => console.error('[flags]', e));
  return ok({ ok: true });
});

/** Undo a pitch logged by mistake. Only while it is still at Pitched. */
export const DELETE = handler(async (_req, ctx) => {
  await connectDB();
  await apiAdmin();
  const id = requireId((await ctx.params).id, 'pitch');
  const pitch = await Pitch.findById(id);
  if (!pitch) throw new ApiError(404, 'Pitch not found.');
  if (pitch.stage !== 'Pitched' || pitch.history.length > 1) throw new ApiError(409, 'Only a pitch still at Pitched can be undone.');
  await pitch.deleteOne();
  const left = await Pitch.countDocuments({ property: pitch.property });
  if (!left) {
    const p = await Property.findById(pitch.property);
    if (p && p.adminStage === 'Pitched') {
      const prev = [...p.stageHistory].reverse().find((h) => h.stage !== 'Pitched')?.stage ?? 'Received';
      p.adminStage = prev;
      p.stageHistory.push({ stage: prev, note: 'Pitch undone', byName: 'System', at: new Date() });
      await p.save();
    }
  }
  syncFlagNotifications().catch((e) => console.error('[flags]', e));
  return ok({ ok: true });
});
