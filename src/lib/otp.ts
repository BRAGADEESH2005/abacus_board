import 'server-only';
import type { Types } from 'mongoose';
import { Otp, type OtpDoc } from '@/models';
import { keyedHash, otpCode, randomToken, safeEqual } from './crypto';
import { OTP_RESEND_MS, OTP_TTL_MS } from './constants';
import { ApiError } from './http';
import { sendOtpEmail } from './mail';
import { sendWhatsAppOtp } from './whatsapp';

const MAX_ATTEMPTS = 5;
const TICKET_TTL_MS = 30 * 60 * 1000;

type SendArgs = {
  purpose: string;
  channel: 'email' | 'whatsapp';
  target: string;
  userType?: 'admin' | 'broker' | 'none';
  userId?: Types.ObjectId | null;
  meta?: Record<string, unknown>;
};

function codeHash(id: string, code: string) {
  return keyedHash(`otp:${id}:${code}`);
}

export async function sendOtp(a: SendArgs) {
  const now = Date.now();
  const recent = await Otp.findOne({ target: a.target, purpose: a.purpose, channel: a.channel, consumedAt: null })
    .sort({ createdAt: -1 })
    .lean<OtpDoc>();
  if (recent && now - new Date(recent.lastSentAt).getTime() < OTP_RESEND_MS) {
    const retryAfter = Math.ceil((OTP_RESEND_MS - (now - new Date(recent.lastSentAt).getTime())) / 1000);
    throw new ApiError(429, `Please wait ${retryAfter} seconds before asking for a new code.`, undefined, { retryAfter });
  }
  // Older codes for the same purpose stop working once a new one is sent.
  await Otp.updateMany({ target: a.target, purpose: a.purpose, channel: a.channel, consumedAt: null }, { $set: { consumedAt: new Date() } });

  const code = otpCode();
  const doc = new Otp({
    purpose: a.purpose,
    channel: a.channel,
    target: a.target,
    userType: a.userType ?? 'none',
    userId: a.userId ?? null,
    codeHash: 'pending',
    // Expiry stored as an absolute Date computed in milliseconds: 10 minutes, checked against server time.
    expiresAt: new Date(now + OTP_TTL_MS),
    lastSentAt: new Date(now),
    meta: a.meta ?? {},
  });
  doc.codeHash = codeHash(doc._id.toString(), code);
  await doc.save();
  try {
    if (a.channel === 'email') await sendOtpEmail(a.target, code, a.purpose);
    else await sendWhatsAppOtp(a.target, code);
  } catch (err) {
    await Otp.deleteOne({ _id: doc._id });
    if (err instanceof ApiError) throw err;
    console.error('[otp] delivery failed', err);
    throw new ApiError(502, a.channel === 'email' ? 'We could not send the email. Check the address and try again.' : 'We could not send the WhatsApp code.');
  }
  return { otpId: doc._id.toString(), expiresInSec: OTP_TTL_MS / 1000, resendInSec: OTP_RESEND_MS / 1000 };
}

/** Checks a code. On success marks it verified and returns a short lived ticket. */
export async function verifyOtp(otpId: string, code: string, purpose: string) {
  const otp = await Otp.findById(otpId);
  if (!otp || otp.purpose !== purpose || otp.consumedAt) throw new ApiError(400, 'This code is no longer valid. Ask for a new one.');
  if (otp.expiresAt.getTime() <= Date.now()) throw new ApiError(400, 'This code has expired. Ask for a new one.');
  if (otp.attempts >= MAX_ATTEMPTS) throw new ApiError(429, 'Too many wrong tries. Ask for a new code.');
  otp.attempts += 1;
  if (!safeEqual(otp.codeHash, codeHash(otp._id.toString(), code.trim()))) {
    await otp.save();
    const left = MAX_ATTEMPTS - otp.attempts;
    throw new ApiError(400, left > 0 ? `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong tries. Ask for a new code.');
  }
  const ticket = randomToken(24);
  otp.verifiedAt = new Date();
  otp.ticketHash = keyedHash(`ticket:${ticket}`);
  otp.ticketExpiresAt = new Date(Date.now() + TICKET_TTL_MS);
  await otp.save();
  return { ticket, otp };
}

/** Uses up a verification ticket. Returns the OTP record it belonged to. */
export async function consumeTicket(ticket: string, purpose: string, target: string) {
  const otp = await Otp.findOne({ ticketHash: keyedHash(`ticket:${ticket}`) });
  if (!otp || otp.purpose !== purpose || otp.target !== target || otp.consumedAt || !otp.ticketExpiresAt || otp.ticketExpiresAt < new Date()) {
    return null;
  }
  otp.consumedAt = new Date();
  await otp.save();
  return otp;
}

export async function consumeOtp(otp: { _id: Types.ObjectId }) {
  await Otp.updateOne({ _id: otp._id }, { $set: { consumedAt: new Date() } });
}
