import 'server-only';
import type { z } from 'zod';
import type { AdminSession } from '@/lib/auth';
import { getEnv } from '@/lib/env';
import { ApiError } from '@/lib/http';
import { rentBand } from '@/lib/domain';
import { sqft } from '@/lib/format';
import { nextBrandAskCode, nextRequirementCode } from '@/lib/codes';
import { getSettings } from '@/lib/settings';
import { sendRequirementAlert, type AlertRow } from '@/lib/mail';
import type { brandInput, brandValues, locationRow, postRequirementSchema } from '@/lib/validation';
import { Brand, BrandAsk, Broker, Requirement, RequirementPrivate, type BrokerDoc, type SettingsDoc } from '@/models';
import { activity } from './notify';

type BrandIn = z.output<typeof brandInput>;
type Values = z.output<typeof brandValues>;
type Row = z.output<typeof locationRow>;

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function upsertBrand(b: BrandIn, s: AdminSession) {
  const fields = {
    sector: b.sector,
    contactName: b.contactName,
    designation: b.designation,
    phone: b.phone,
    email: b.email,
    storeModel: b.storeModel,
    fee: b.fee,
    paysNothing: b.paysNothing,
  };
  let brand = b.id && /^[a-f0-9]{24}$/i.test(b.id) ? await Brand.findById(b.id) : null;
  if (!brand) brand = await Brand.findOne({ nameLower: b.name.trim().toLowerCase() });
  if (brand) {
    brand.set(fields);
    await brand.save();
    return { brand, created: false };
  }
  brand = await Brand.create({ name: b.name.trim(), nameLower: b.name.trim().toLowerCase(), ...fields, createdBy: s.admin._id, createdByName: s.admin.name });
  await activity(`New brand added: ${brand.name}`, `${brand.sector} · by ${s.admin.name}`, `/admin/brands/${brand._id}`);
  return { brand, created: true };
}

function resolveRow(settings: SettingsDoc, row: Row) {
  const city = settings.cities.find((c) => c.name === row.city);
  if (!city) throw new ApiError(422, `Unknown city ${row.city}`);
  const mm = city.microMarkets.find((m) => m.name === row.microMarket);
  if (!mm) throw new ApiError(422, `Unknown micro market ${row.microMarket} in ${row.city}`);
  const stretches = row.stretches.filter((s) => (mm.stretches ?? []).includes(s));
  const overrides = row.overrides.filter((o) => stretches.includes(o.stretch));
  return { city, mm, stretches, overrides };
}

function publicFields(values: Values, row: Row, stretches: string[], overrides: Row['overrides'], paysNothing: boolean, sector: string) {
  const band = rentBand(row.rentMin, row.rentMax);
  return {
    sector,
    stretches,
    stretchCarpet: overrides.map((o) => ({ stretch: o.stretch, carpetMin: o.carpetMin, carpetMax: o.carpetMax })),
    formats: values.formats,
    carpetMin: row.carpetMin,
    carpetMax: row.carpetMax,
    rentBandMin: band.min,
    rentBandMax: band.max,
    minFrontage: values.minFrontage,
    floors: values.floors,
    minCeiling: values.minCeiling,
    minPowerKva: values.minPowerKva,
    conditionAccepted: values.conditionAccepted,
    parkingCars: values.parkingCars,
    parkingBikes: values.parkingBikes,
    signage: values.signage,
    otherSpecs: values.otherSpecs,
    maxDepositMonths: values.maxDepositMonths,
    leaseYears: values.leaseYears,
    lockInYears: values.lockInYears,
    paysNothingNotice: paysNothing,
    priority: values.priority,
  };
}

/** Post a requirement once per brand: one brand ask (BRD), one requirement per micro market (REQ). */
export async function postBrandAsk(input: z.output<typeof postRequirementSchema>, s: AdminSession) {
  const settings = await getSettings();
  const resolved = input.rows.map((r) => ({ row: r, ...resolveRow(settings, r) }));
  const seen = new Set<string>();
  for (const r of resolved) {
    const k = `${r.city.name}|${r.mm.name}`;
    if (seen.has(k)) throw new ApiError(422, `${r.mm.name}, ${r.city.name} is listed twice.`);
    seen.add(k);
  }
  const { brand } = await upsertBrand(input.brand, s);
  const ask = await BrandAsk.create({ code: await nextBrandAskCode(), brand: brand._id, createdBy: s.admin._id, createdByName: s.admin.name, values: { ...input.values, rows: input.rows } });
  const created: { id: string; code: string; city: string; microMarket: string }[] = [];
  for (const r of resolved) {
    const code = await nextRequirementCode(r.city.code);
    const req = await Requirement.create({
      code,
      city: r.city.name,
      state: r.city.state,
      microMarket: r.mm.name,
      status: 'open',
      postedAt: new Date(),
      ...publicFields(input.values, r.row, r.stretches, r.overrides, input.brand.paysNothing, input.brand.sector),
    });
    await RequirementPrivate.create({
      requirement: req._id,
      brand: brand._id,
      brandAsk: ask._id,
      rentMin: r.row.rentMin,
      rentMax: r.row.rentMax,
      stretchRent: r.overrides.map((o) => ({ stretch: o.stretch, rentMin: o.rentMin, rentMax: o.rentMax })),
      storesWanted: r.row.storesWanted,
      fee: input.brand.fee,
      paysNothing: input.brand.paysNothing,
      internalNotes: input.values.internalNotes,
      receivedOn: input.values.receivedOn ? new Date(input.values.receivedOn) : null,
      createdBy: s.admin._id,
      createdByName: s.admin.name,
    });
    created.push({ id: req._id.toString(), code, city: r.city.name, microMarket: r.mm.name });
  }
  const cities = [...new Set(created.map((c) => c.city))];
  await activity(
    `New requirement: ${brand.name} (${ask.code})`,
    `${created.length} location${created.length === 1 ? '' : 's'} in ${cities.join(', ')} · by ${s.admin.name}`,
    `/admin/brands/${brand._id}`,
  );
  // Alerts only for brokers who cover these cities (Broker Skeleton 10.5). Sent in the background.
  alertBrokers(created.map((c) => c.id)).catch((e) => console.error('[alerts]', e));
  return { brand, ask, created };
}

export async function alertBrokers(reqIds: string[]) {
  const reqs = await Requirement.find({ _id: { $in: reqIds } }).lean();
  if (!reqs.length) return 0;
  const cities = [...new Set(reqs.map((r) => r.city))];
  const brokers = await Broker.find({ status: 'active', emailVerified: true, $or: [{ city: { $in: cities } }, { 'microMarkets.city': { $in: cities } }] })
    .select('fullName email city microMarkets')
    .lean<BrokerDoc[]>();
  const app = getEnv().APP_URL;
  let sent = 0;
  for (const b of brokers) {
    const mine = new Set([b.city, ...(b.microMarkets ?? []).map((m) => m.city)]);
    const rows: AlertRow[] = reqs
      .filter((r) => mine.has(r.city))
      .map((r) => ({
        code: r.code,
        location: `${r.microMarket}, ${r.city}`,
        sector: r.sector,
        carpet: sqft(r.carpetMin, r.carpetMax),
        rent: `₹${r.rentBandMin} to ${r.rentBandMax} per sq ft`,
        specs: [r.minFrontage ? `${r.minFrontage} ft+ frontage` : '', (r.floors ?? []).join(', ')].filter(Boolean).join(' · '),
        url: `${app}/broker/requirements/${r._id}`,
      }));
    if (!rows.length) continue;
    try {
      await sendRequirementAlert(b.email, b.fullName.split(' ')[0] ?? b.fullName, rows);
      sent++;
    } catch (e) {
      console.error('[alerts] failed for', b.email, e);
    }
  }
  return sent;
}

export async function editRequirement(id: string, values: Values, row: Row, status: 'open' | 'on_hold' | 'closed', s: AdminSession) {
  const req = await Requirement.findById(id);
  const priv = await RequirementPrivate.findOne({ requirement: id });
  if (!req || !priv) throw new ApiError(404, 'That requirement was not found.');
  if (row.city !== req.city || row.microMarket !== req.microMarket) throw new ApiError(422, 'City and micro market cannot change. Post a new requirement instead.');
  const settings = await getSettings();
  const { stretches, overrides } = resolveRow(settings, row);
  const brand = await Brand.findById(priv.brand);
  req.set(publicFields(values, row, stretches, overrides, priv.paysNothing, brand?.sector ?? req.sector));
  if (status !== req.status) {
    req.status = status;
    req.closedAt = status === 'closed' ? new Date() : null;
    await activity(`${req.code} marked ${status === 'on_hold' ? 'on hold' : status}`, `${brand?.name ?? ''} · ${req.microMarket}, ${req.city} · by ${s.admin.name}`, `/admin/requirements/${req._id}`);
  }
  await req.save();
  priv.set({
    rentMin: row.rentMin,
    rentMax: row.rentMax,
    storesWanted: row.storesWanted,
    stretchRent: overrides.map((o) => ({ stretch: o.stretch, rentMin: o.rentMin, rentMax: o.rentMax })),
    internalNotes: values.internalNotes,
    receivedOn: values.receivedOn ? new Date(values.receivedOn) : null,
  });
  await priv.save();
  return req;
}

export { escapeRe };
