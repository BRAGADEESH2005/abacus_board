import { connectDB } from '@/lib/db';
import { apiAdmin } from '@/lib/auth';
import { handler, ok, parseBody } from '@/lib/http';
import { postRequirementSchema } from '@/lib/validation';
import { postBrandAsk } from '@/lib/services/requirements';

export const POST = handler(async (req) => {
  await connectDB();
  const s = await apiAdmin();
  const input = await parseBody(req, postRequirementSchema);
  const { brand, ask, created } = await postBrandAsk(input, s);
  return ok({ brandId: brand._id.toString(), askCode: ask.code, created });
});
