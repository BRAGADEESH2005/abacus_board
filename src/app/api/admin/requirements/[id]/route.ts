import { connectDB } from '@/lib/db';
import { apiAdmin } from '@/lib/auth';
import { handler, ok, parseBody, requireId } from '@/lib/http';
import { editRequirementSchema } from '@/lib/validation';
import { editRequirement } from '@/lib/services/requirements';

export const PATCH = handler(async (req, ctx) => {
  await connectDB();
  const s = await apiAdmin();
  const id = requireId((await ctx.params).id, 'requirement');
  const { values, row, status } = await parseBody(req, editRequirementSchema);
  await editRequirement(id, values, row, status, s);
  return ok({ ok: true });
});
