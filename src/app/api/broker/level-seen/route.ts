import { connectDB } from '@/lib/db';
import { apiBroker } from '@/lib/auth';
import { handler, ok } from '@/lib/http';
import { Broker } from '@/models';

/** Marks the level up celebration as seen. */
export const POST = handler(async () => {
  await connectDB();
  const s = await apiBroker();
  await Broker.updateOne({ _id: s.broker._id }, { $set: { levelSeen: s.broker.level } });
  return ok({ ok: true });
});
