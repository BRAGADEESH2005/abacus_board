import { connectDB } from '@/lib/db';
import { ApiError, handler, ok, parseBody } from '@/lib/http';
import { otpSendSchema } from '@/lib/validation';
import { normalizePhone } from '@/lib/format';
import { sendOtp } from '@/lib/otp';
import { getSession } from '@/lib/auth';
import { whatsappEnabled } from '@/lib/env';
import { Broker } from '@/models';

export const POST = handler(async (req) => {
  await connectDB();
  const body = await parseBody(req, otpSendSchema);
  let target = body.target.trim();
  if (body.channel === 'whatsapp') {
    if (!whatsappEnabled()) throw new ApiError(400, 'WhatsApp verification is switched off on this board.');
    const p = normalizePhone(target);
    if (!p) throw new ApiError(422, 'Enter a valid 10 digit Indian mobile number', { target: 'Enter a valid 10 digit Indian mobile number' });
    target = p;
  } else {
    target = target.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) throw new ApiError(422, 'Enter a valid email address', { target: 'Enter a valid email address' });
  }

  if (body.purpose === 'signup') {
    const clash = await Broker.findOne(body.channel === 'email' ? { email: target } : { phone: target }).select('_id').lean();
    if (clash) throw new ApiError(409, body.channel === 'email' ? 'This email is already registered. Log in instead.' : 'This phone number is already registered. Log in instead.');
    return ok(await sendOtp({ purpose: 'signup', channel: body.channel, target }));
  }

  // Changing email or phone from the profile page needs a signed in broker.
  const s = await getSession();
  if (!s || s.type !== 'broker') throw new ApiError(401, 'Please log in again.');
  if (body.purpose === 'change_email' && body.channel !== 'email') throw new ApiError(400, 'Email changes are verified by email.');
  if (body.purpose === 'change_phone' && body.channel !== 'whatsapp') throw new ApiError(400, 'Phone changes are verified on WhatsApp.');
  const clash = await Broker.findOne({ ...(body.channel === 'email' ? { email: target } : { phone: target }), _id: { $ne: s.broker._id } }).select('_id').lean();
  if (clash) throw new ApiError(409, 'That is already registered to another account.');
  return ok(await sendOtp({ purpose: body.purpose, channel: body.channel, target, userType: 'broker', userId: s.broker._id }));
});
