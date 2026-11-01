import { connectDB } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { ApiError, handler, ok } from '@/lib/http';
import { safeEqual } from '@/lib/crypto';
import { runDueJobs } from '@/lib/services/jobs';

/** For an external scheduler (e.g. Vercel Cron at 03:30 UTC = 9 am IST). Bearer CRON_SECRET. */
export const GET = handler(async (req) => {
  const secret = getEnv().CRON_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) throw new ApiError(401, 'Unauthorized');
  await connectDB();
  return ok(await runDueJobs(true));
});
