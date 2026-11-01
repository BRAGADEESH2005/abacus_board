import { connectDB } from '@/lib/db';
import { apiAdmin } from '@/lib/auth';
import { handler, ok } from '@/lib/http';
import { escapeRe } from '@/lib/services/requirements';
import { Brand } from '@/models';

/** Brand search for the "pick from brand list or add new" field. */
export const GET = handler(async (req) => {
  await connectDB();
  await apiAdmin();
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
  const list = await Brand.find(q ? { name: { $regex: escapeRe(q), $options: 'i' } } : {})
    .sort({ name: 1 })
    .limit(20)
    .select('name sector contactName designation phone email storeModel fee paysNothing')
    .lean();
  return ok({ brands: list.map((b) => ({ ...b, id: String(b._id), _id: undefined })) });
});
