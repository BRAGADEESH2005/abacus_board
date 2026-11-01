import { connectDB } from '@/lib/db';
import { ApiError, handler, ok, parseBody } from '@/lib/http';
import { adminLoginSchema } from '@/lib/validation';
import { verifyPassword } from '@/lib/crypto';
import { createSession, deviceHash, ensureDeviceId } from '@/lib/auth';
import { sendOtp } from '@/lib/otp';
import { Admin } from '@/models';

const LOCK_AFTER = 5;
const LOCK_MS = 10 * 60 * 1000;

/**
 * Admin login. Password every time; email OTP only on the first login and on a new browser.
 * A known browser gets a 30 day session straight away.
 */
export const POST = handler(async (req) => {
  await connectDB();
  const { email, password } = await parseBody(req, adminLoginSchema);
  const admin = await Admin.findOne({ email });
  const fail = () => new ApiError(401, 'That email and password do not match.');
  if (!admin) throw fail();
  if (admin.lockUntil && admin.lockUntil > new Date()) throw new ApiError(429, 'Too many wrong passwords. Try again in 10 minutes or reset your password.');
  if (!(await verifyPassword(password, admin.passwordHash))) {
    admin.failedLogins += 1;
    if (admin.failedLogins >= LOCK_AFTER) {
      admin.lockUntil = new Date(Date.now() + LOCK_MS);
      admin.failedLogins = 0;
    }
    await admin.save();
    throw fail();
  }
  admin.failedLogins = 0;
  admin.lockUntil = null;
  const device = await ensureDeviceId();
  const dh = deviceHash(device);
  const trusted = admin.emailVerifiedAt && admin.trustedDevices.some((d) => d.hash === dh);
  if (trusted) {
    const d = admin.trustedDevices.find((x) => x.hash === dh);
    if (d) d.lastSeenAt = new Date();
    await admin.save();
    await createSession('admin', admin._id, true);
    return ok({ ok: true, redirect: '/admin' });
  }
  await admin.save();
  const sent = await sendOtp({ purpose: 'admin_device', channel: 'email', target: admin.email, userType: 'admin', userId: admin._id, meta: { deviceHash: dh } });
  return ok({ otpRequired: true, ...sent, email: admin.email.replace(/^(.{2}).*(@.*)$/, '$1•••$2'), firstLogin: !admin.emailVerifiedAt });
});
