import { connectDB } from '@/lib/db';
import { apiBroker } from '@/lib/auth';
import { ApiError, handler, ok, parseBody } from '@/lib/http';
import { usernameSchema } from '@/lib/validation';
import { USERNAME_CHANGE_DAYS } from '@/lib/constants';
import { Broker } from '@/models';
import { z } from 'zod';

/** Username can change once every 30 days. */
export const POST = handler(async (req) => {
  await connectDB();
  const s = await apiBroker();
  const { username } = await parseBody(req, z.object({ username: usernameSchema }));
  if (username === s.broker.username) return ok({ username });
  const last = s.broker.usernameChangedAt ? new Date(s.broker.usernameChangedAt).getTime() : 0;
  const wait = last + USERNAME_CHANGE_DAYS * 86400000 - Date.now();
  if (wait > 0) {
    const days = Math.ceil(wait / 86400000);
    throw new ApiError(429, `You can change your username again in ${days} day${days === 1 ? '' : 's'}.`);
  }
  const taken = await Broker.findOne({ username, _id: { $ne: s.broker._id } }).select('_id').lean();
  if (taken) throw new ApiError(409, 'That username is taken.', { username: 'Taken' });
  await Broker.updateOne({ _id: s.broker._id }, { $set: { username, usernameChangedAt: new Date() } });
  return ok({ username });
});
