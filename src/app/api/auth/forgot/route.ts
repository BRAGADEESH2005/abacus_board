import { Types } from 'mongoose';
import { connectDB } from '@/lib/db';
import { ApiError, handler, ok, parseBody } from '@/lib/http';
import { forgotSchema } from '@/lib/validation';
import { normalizePhone } from '@/lib/format';
import { sendOtp } from '@/lib/otp';
import { whatsappEnabled } from '@/lib/env';
import { Admin, Broker } from '@/models';
import { OTP_RESEND_MS, OTP_TTL_MS } from '@/lib/constants';

/** Forgot password: OTP on email (admins and brokers) or WhatsApp (brokers, when switched on). */
export const POST = handler(async (req) => {
  await connectDB();
  const { role, identifier, channel } = await parseBody(req, forgotSchema);
  const id = identifier.trim().toLowerCase();
  // Same answer whether or not the account exists, so the form cannot be used to probe accounts.
  const generic = { otpId: new Types.ObjectId().toString(), expiresInSec: OTP_TTL_MS / 1000, resendInSec: OTP_RESEND_MS / 1000 };

  if (role === 'admin') {
    const admin = await Admin.findOne({ email: id }).lean();
    if (!admin) return ok(generic);
    return ok(await sendOtp({ purpose: 'reset', channel: 'email', target: admin.email, userType: 'admin', userId: admin._id }));
  }
  const phone = normalizePhone(id);
  const broker = await Broker.findOne(id.includes('@') ? { email: id } : phone ? { $or: [{ phone }, { username: id }] } : { username: id }).lean();
  if (!broker) return ok(generic);
  if (channel === 'whatsapp') {
    if (!whatsappEnabled()) throw new ApiError(400, 'WhatsApp codes are switched off. Use email instead.');
    return ok(await sendOtp({ purpose: 'reset', channel: 'whatsapp', target: broker.phone, userType: 'broker', userId: broker._id }));
  }
  return ok(await sendOtp({ purpose: 'reset', channel: 'email', target: broker.email, userType: 'broker', userId: broker._id }));
});
