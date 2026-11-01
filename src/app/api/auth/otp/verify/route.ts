import { connectDB } from '@/lib/db';
import { ApiError, handler, ok, parseBody } from '@/lib/http';
import { otpVerifySchema } from '@/lib/validation';
import { verifyOtp } from '@/lib/otp';
import { z } from 'zod';

const schema = otpVerifySchema.extend({ purpose: z.enum(['signup', 'change_email', 'change_phone']) });

export const POST = handler(async (req) => {
  await connectDB();
  const { otpId, code, purpose } = await parseBody(req, schema);
  if (!/^[a-f0-9]{24}$/i.test(otpId)) throw new ApiError(400, 'This code is no longer valid. Ask for a new one.');
  const { ticket, otp } = await verifyOtp(otpId, code, purpose);
  return ok({ ticket, target: otp.target, channel: otp.channel });
});
