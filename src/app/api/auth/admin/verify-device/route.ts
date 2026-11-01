import { connectDB } from '@/lib/db';
import { ApiError, handler, ok, parseBody } from '@/lib/http';
import { otpVerifySchema } from '@/lib/validation';
import { consumeOtp, verifyOtp } from '@/lib/otp';
import { createSession, deviceHash, getDeviceId } from '@/lib/auth';
import { Admin } from '@/models';

/** Confirms the emailed code, remembers this browser and signs the admin in for 30 days. */
export const POST = handler(async (req) => {
  await connectDB();
  const { otpId, code } = await parseBody(req, otpVerifySchema);
  if (!/^[a-f0-9]{24}$/i.test(otpId)) throw new ApiError(400, 'This code is no longer valid. Log in again.');
  const { otp } = await verifyOtp(otpId, code, 'admin_device');
  const device = await getDeviceId();
  const dh = device ? deviceHash(device) : null;
  if (!dh || (otp.meta as { deviceHash?: string })?.deviceHash !== dh) throw new ApiError(400, 'Finish signing in on the same browser you started on.');
  await consumeOtp(otp);
  const admin = await Admin.findById(otp.userId);
  if (!admin) throw new ApiError(404, 'Account not found.');
  if (!admin.emailVerifiedAt) admin.emailVerifiedAt = new Date();
  const ua = (req.headers.get('user-agent') ?? 'Browser').slice(0, 120);
  if (!admin.trustedDevices.some((d) => d.hash === dh)) admin.trustedDevices.push({ hash: dh, label: ua, createdAt: new Date(), lastSeenAt: new Date() });
  if (admin.trustedDevices.length > 20) admin.trustedDevices.splice(0, admin.trustedDevices.length - 20);
  await admin.save();
  await createSession('admin', admin._id, true);
  return ok({ ok: true, redirect: '/admin' });
});
