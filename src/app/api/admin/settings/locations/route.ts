import { connectDB } from '@/lib/db';
import { apiAdmin } from '@/lib/auth';
import { ApiError, handler, ok, parseBody } from '@/lib/http';
import { getSettings, locationLists } from '@/lib/settings';
import { Broker, Property, Requirement, Settings } from '@/models';
import { z } from 'zod';

const name = z.string().trim().min(1, 'Enter a name').max(80);
const coord = (lim: number) => z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.number().min(-lim).max(lim).nullable());
const oid = z.string().regex(/^[a-f0-9]{24}$/i);

const schema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('addCity'), name, code: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Use a three letter code'), state: name, lat: coord(90), lng: coord(180) }),
  z.object({ op: z.literal('updateCity'), cityId: oid, enabled: z.boolean().optional(), state: name.optional(), lat: coord(90).optional(), lng: coord(180).optional() }),
  z.object({ op: z.literal('addMM'), cityId: oid, name, lat: coord(90), lng: coord(180), radiusM: z.coerce.number().min(100).max(20000).default(1200) }),
  z.object({ op: z.literal('updateMM'), cityId: oid, mmId: oid, name: name.optional(), lat: coord(90).optional(), lng: coord(180).optional(), radiusM: z.coerce.number().min(100).max(20000).optional() }),
  z.object({ op: z.literal('removeMM'), cityId: oid, mmId: oid }),
  z.object({ op: z.literal('addStretch'), cityId: oid.optional(), mmId: oid.optional(), city: z.string().optional(), microMarket: z.string().optional(), stretch: name }),
  z.object({ op: z.literal('removeStretch'), cityId: oid, mmId: oid, stretch: name }),
]);

/** Cities, micro markets and stretches live in one admin edited list that feeds every dropdown. */
export const POST = handler(async (req) => {
  await connectDB();
  await apiAdmin();
  const d = await parseBody(req, schema);
  await getSettings();
  const doc = await Settings.findById('global');
  if (!doc) throw new ApiError(500, 'Settings missing.');
  const cities = doc.cities as unknown as import('mongoose').Types.DocumentArray<import('@/models').CityDoc & import('mongoose').Types.Subdocument>;
  const findCity = (id?: string, nm?: string) => (id ? cities.id(id) : cities.find((c) => c.name === nm)) ?? null;

  switch (d.op) {
    case 'addCity': {
      if (cities.some((c) => c.name.toLowerCase() === d.name.toLowerCase())) throw new ApiError(409, 'That city is already on the list.');
      if (cities.some((c) => c.code === d.code)) throw new ApiError(409, 'That city code is already used.');
      cities.push({ name: d.name, code: d.code, state: d.state, lat: d.lat ?? undefined, lng: d.lng ?? undefined, enabled: true, microMarkets: [] } as never);
      break;
    }
    case 'updateCity': {
      const c = findCity(d.cityId);
      if (!c) throw new ApiError(404, 'City not found.');
      if (d.enabled !== undefined) c.enabled = d.enabled;
      if (d.state) c.state = d.state;
      if (d.lat !== undefined) c.lat = d.lat ?? undefined;
      if (d.lng !== undefined) c.lng = d.lng ?? undefined;
      if (d.state) await Requirement.updateMany({ city: c.name }, { $set: { state: d.state } });
      break;
    }
    case 'addMM': {
      const c = findCity(d.cityId);
      if (!c) throw new ApiError(404, 'City not found.');
      if (c.microMarkets.some((m) => m.name.toLowerCase() === d.name.toLowerCase())) throw new ApiError(409, 'That micro market is already on the list.');
      c.microMarkets.push({ name: d.name, lat: d.lat, lng: d.lng, radiusM: d.radiusM, stretches: [] } as never);
      break;
    }
    case 'updateMM': {
      const c = findCity(d.cityId);
      const m = c?.microMarkets.find((x) => x._id.toString() === d.mmId);
      if (!c || !m) throw new ApiError(404, 'Micro market not found.');
      if (d.name && d.name !== m.name) {
        if (c.microMarkets.some((x) => x.name.toLowerCase() === d.name!.toLowerCase())) throw new ApiError(409, 'That name is already used in this city.');
        const old = m.name;
        m.name = d.name;
        await Promise.all([
          Requirement.updateMany({ city: c.name, microMarket: old }, { $set: { microMarket: d.name } }),
          Property.updateMany({ city: c.name, microMarket: old }, { $set: { microMarket: d.name } }),
          Broker.updateMany({ microMarkets: { $elemMatch: { city: c.name, name: old } } }, { $set: { 'microMarkets.$[e].name': d.name } }, { arrayFilters: [{ 'e.city': c.name, 'e.name': old }] }),
        ]);
      }
      if (d.lat !== undefined) m.lat = d.lat;
      if (d.lng !== undefined) m.lng = d.lng;
      if (d.radiusM !== undefined) m.radiusM = d.radiusM;
      break;
    }
    case 'removeMM': {
      const c = findCity(d.cityId);
      const m = c?.microMarkets.find((x) => x._id.toString() === d.mmId);
      if (!c || !m) throw new ApiError(404, 'Micro market not found.');
      const used = (await Requirement.countDocuments({ city: c.name, microMarket: m.name })) + (await Property.countDocuments({ city: c.name, microMarket: m.name }));
      if (used) throw new ApiError(409, `${m.name} is used by ${used} requirement(s) or propert(ies) and cannot be removed. Rename it instead.`);
      c.microMarkets = c.microMarkets.filter((x) => x._id.toString() !== d.mmId) as never;
      break;
    }
    case 'addStretch': {
      const c = findCity(d.cityId, d.city);
      const m = c?.microMarkets.find((x) => (d.mmId ? x._id.toString() === d.mmId : x.name === d.microMarket));
      if (!c || !m) throw new ApiError(404, 'Micro market not found.');
      if (!(m.stretches ?? []).some((s) => s.toLowerCase() === d.stretch.toLowerCase())) m.stretches = [...(m.stretches ?? []), d.stretch];
      break;
    }
    case 'removeStretch': {
      const c = findCity(d.cityId);
      const m = c?.microMarkets.find((x) => x._id.toString() === d.mmId);
      if (!c || !m) throw new ApiError(404, 'Micro market not found.');
      m.stretches = (m.stretches ?? []).filter((s) => s !== d.stretch);
      break;
    }
  }
  doc.markModified('cities');
  await doc.save();
  const fresh = await getSettings();
  return ok({ locations: locationLists(fresh, true), cities: fresh.cities.map((c) => ({ id: String(c._id), name: c.name, microMarkets: c.microMarkets.map((m) => ({ id: String(m._id), name: m.name })) })) });
});
