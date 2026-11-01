import { connectDB } from '@/lib/db';
import { apiBroker } from '@/lib/auth';
import { ApiError, handler, ok, parseBody } from '@/lib/http';
import { profileSchema } from '@/lib/validation';
import { normalizePhone } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { Broker } from '@/models';

export const PATCH = handler(async (req) => {
  await connectDB();
  const s = await apiBroker();
  const d = await parseBody(req, profileSchema);
  const settings = await getSettings();
  if (!settings.cities.some((c) => c.enabled && c.name === d.city)) throw new ApiError(422, 'Pick a city from the list', { city: 'Pick a city from the list' });
  const mms = d.microMarkets.filter((m) => settings.cities.find((c) => c.name === m.city)?.microMarkets.some((x) => x.name === m.name));
  await Broker.updateOne(
    { _id: s.broker._id },
    { $set: { fullName: d.fullName, company: d.company, city: d.city, altPhone: normalizePhone(d.altPhone) ?? '', microMarkets: mms } },
  );
  return ok({ ok: true });
});
