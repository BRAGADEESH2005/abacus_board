import { connectDB } from '@/lib/db';
import { apiBroker } from '@/lib/auth';
import { ApiError, handler, ok, parseBody, requireId } from '@/lib/http';
import { activity } from '@/lib/services/notify';
import { Property } from '@/models';
import { z } from 'zod';

const LABEL = { available: 'Available', let_out: 'Let out', withdrawn: 'Withdrawn' } as const;

/** Broker set listing status, and the one tap "Still available" reconfirmation. */
export const POST = handler(async (req, ctx) => {
  await connectDB();
  const s = await apiBroker();
  const id = requireId((await ctx.params).id, 'property');
  const { action } = await parseBody(req, z.object({ action: z.enum(['reconfirm', 'available', 'let_out', 'withdrawn']) }));
  const p = await Property.findById(id);
  if (!p || String(p.broker) !== String(s.broker._id)) throw new ApiError(404, 'That property was not found.');
  if (p.state !== 'submitted') throw new ApiError(409, 'Post the property first.');
  const before = p.listingStatus;
  if (action === 'reconfirm' || action === 'available') {
    p.listingStatus = 'available';
    p.lastConfirmedAt = new Date();
  } else {
    p.listingStatus = action;
  }
  await p.save();
  if (before !== p.listingStatus && action !== 'reconfirm') {
    await activity(`${p.code} marked ${LABEL[action as keyof typeof LABEL] ?? 'Available'} by the broker`, `${p.microMarket}, ${p.city} · ${s.broker.fullName}`, `/admin/properties/${p._id}`);
  }
  return ok({ listingStatus: p.listingStatus, lastConfirmedAt: p.lastConfirmedAt });
});
