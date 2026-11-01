import { connectDB } from '@/lib/db';
import { ApiError, handler, ok, parseBody } from '@/lib/http';
import { resetSchema } from '@/lib/validation';
import { consumeOtp, verifyOtp } from '@/lib/otp';
import { hashPassword } from '@/lib/crypto';
import { revokeAllSessions } from '@/lib/auth';
import { sendPasswordChanged } from '@/lib/mail';
import { Admin, Broker } from '@/models';

export const POST = handler(async (req) => {
  await connectDB();
  const { otpId, code, password } = await parseBody(req, resetSchema);
  if (!/^[a-f0-9]{24}$/i.test(otpId)) throw new ApiError(400, 'That code is not right.');
  const { otp } = await verifyOtp(otpId, code, 'reset');
  await consumeOtp(otp);
  const hash = await hashPassword(password);
  if (otp.userType === 'admin') {
    const a = await Admin.findByIdAndUpdate(otp.userId, { $set: { passwordHash: hash, failedLogins: 0, lockUntil: null } }, { new: true });
    if (!a) throw new ApiError(404, 'Account not found.');
    await revokeAllSessions(a._id);
    sendPasswordChanged(a.email, a.name).catch((e) => console.error('[mail]', e));
    return ok({ ok: true, redirect: '/admin/login' });
  }
  const b = await Broker.findByIdAndUpdate(otp.userId, { $set: { passwordHash: hash, failedLogins: 0, lockUntil: null } }, { new: true });
  if (!b) throw new ApiError(404, 'Account not found.');
  await revokeAllSessions(b._id);
  sendPasswordChanged(b.email, b.fullName).catch((e) => console.error('[mail]', e));
  return ok({ ok: true, redirect: '/login' });
});
