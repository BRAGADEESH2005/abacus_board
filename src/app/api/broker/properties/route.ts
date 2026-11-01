import { connectDB } from '@/lib/db';
import { apiBroker } from '@/lib/auth';
import { ApiError, handler, ok, parseBody } from '@/lib/http';
import { getSettings } from '@/lib/settings';
import { nextPropertyCode } from '@/lib/codes';
import { Property } from '@/models';
import { z } from 'zod';

/** Creates a draft and reserves its property code straight away (Broker v2, 7b). */
export const POST = handler(async (req) => {
  await connectDB();
  const s = await apiBroker();
  const body = await parseBody(req, z.object({ city: z.string().trim().min(1, 'Pick a city'), microMarket: z.string().trim().optional().default('') }));
  const settings = await getSettings();
  const city = settings.cities.find((c) => c.enabled && c.name === body.city);
  if (!city) throw new ApiError(422, 'Pick a city from the list', { city: 'Pick a city from the list' });
  const mm = city.microMarkets.find((m) => m.name === body.microMarket)?.name ?? '';
  const drafts = await Property.countDocuments({ broker: s.broker._id, state: 'draft' });
  if (drafts >= 20) throw new ApiError(429, 'You have 20 unfinished drafts. Finish or delete some first.');
  const code = await nextPropertyCode(city.code);
  const p = await Property.create({ code, broker: s.broker._id, city: city.name, microMarket: mm, state: 'draft' });
  return ok({ id: p._id.toString(), code });
});
