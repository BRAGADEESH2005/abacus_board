import { connectDB } from '@/lib/db';
import { apiBroker } from '@/lib/auth';
import { ApiError, handler, ok, parseBody } from '@/lib/http';
import { consumeTicket } from '@/lib/otp';
import { normalizePhone } from '@/lib/format';
import { Broker } from '@/models';
import { z } from 'zod';

/** Email changes need a fresh email OTP; phone changes a fresh WhatsApp OTP. */
export const POST = handler(async (req) => {
  await connectDB();
  const s = await apiBroker();
  const { kind, value, ticket } = await parseBody(req, z.object({ kind: z.enum(['email', 'phone']), value: z.string().trim().min(3).max(200), ticket: z.string().min(10) }));
  const target = kind === 'email' ? value.toLowerCase() : normalizePhone(value);
  if (!target) throw new ApiError(422, 'Enter a valid number');
  const otp = await consumeTicket(ticket, kind === 'email' ? 'change_email' : 'change_phone', target);
  if (!otp || String(otp.userId) !== String(s.broker._id)) throw new ApiError(422, 'Verification expired. Verify again.');
  const clash = await Broker.findOne({ [kind]: target, _id: { $ne: s.broker._id } }).select('_id').lean();
  if (clash) throw new ApiError(409, 'That is already registered to another account.');
  await Broker.updateOne({ _id: s.broker._id }, { $set: kind === 'email' ? { email: target, emailVerified: true } : { phone: target, phoneVerified: true } });
  return ok({ ok: true });
});
