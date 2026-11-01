import { connectDB } from '@/lib/db';
import { ApiError, handler, ok, parseBody } from '@/lib/http';
import { signupSchema } from '@/lib/validation';
import { consumeTicket } from '@/lib/otp';
import { hashPassword } from '@/lib/crypto';
import { createSession } from '@/lib/auth';
import { whatsappEnabled } from '@/lib/env';
import { normalizePhone } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { activity } from '@/lib/services/notify';
import { Broker } from '@/models';

/** Compulsory sign up: both OTPs (email, and WhatsApp when switched on) must be verified first. */
export const POST = handler(async (req) => {
  await connectDB();
  const d = await parseBody(req, signupSchema);
  const settings = await getSettings();
  if (!settings.cities.some((c) => c.enabled && c.name === d.city)) throw new ApiError(422, 'Pick a city from the list', { city: 'Pick a city from the list' });

  const clash = await Broker.findOne({ $or: [{ email: d.email }, { phone: d.phone }, { username: d.username }] }).select('email phone username').lean();
  if (clash) {
    if (clash.email === d.email) throw new ApiError(409, 'This email is already registered. Log in instead.', { email: 'Already registered' });
    if (clash.phone === d.phone) throw new ApiError(409, 'This phone number is already registered. Log in instead.', { phone: 'Already registered' });
    throw new ApiError(409, 'That username was just taken. Pick another.', { username: 'Taken' });
  }

  const wa = whatsappEnabled();
  if (wa && !d.phoneTicket) throw new ApiError(422, 'Verify your WhatsApp number first', { phone: 'Verify your WhatsApp number first' });
  const emailOtp = await consumeTicket(d.emailTicket, 'signup', d.email);
  if (!emailOtp) throw new ApiError(422, 'Your email verification expired. Verify it again.', { email: 'Verify again' });
  if (wa) {
    const phoneOtp = await consumeTicket(d.phoneTicket, 'signup', d.phone);
    if (!phoneOtp) throw new ApiError(422, 'Your phone verification expired. Verify it again.', { phone: 'Verify again' });
  }

  const broker = await Broker.create({
    fullName: d.fullName,
    username: d.username,
    phone: d.phone,
    phoneVerified: wa,
    altPhone: normalizePhone(d.altPhone) ?? '',
    email: d.email,
    emailVerified: true,
    city: d.city,
    company: d.company,
    passwordHash: await hashPassword(d.password),
    level: 'scout',
    levelSeen: 'scout',
  });
  await createSession('broker', broker._id, true);
  await activity(`New broker signed up: ${broker.fullName}`, `${broker.company} · ${broker.city} · @${broker.username}`, `/admin/brokers/${broker._id}`);
  return ok({ ok: true, redirect: '/broker' });
});
