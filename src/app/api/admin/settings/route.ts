import { connectDB } from '@/lib/db';
import { apiAdmin } from '@/lib/auth';
import { handler, ok, parseBody } from '@/lib/http';
import { settingsTextSchema } from '@/lib/validation';
import { getSettings } from '@/lib/settings';
import { Settings } from '@/models';

export const PUT = handler(async (req) => {
  await connectDB();
  await apiAdmin();
  const d = await parseBody(req, settingsTextSchema);
  await getSettings();
  await Settings.updateOne({ _id: 'global' }, { $set: d });
  return ok({ ok: true });
});
