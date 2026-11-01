import { connectDB } from '@/lib/db';
import { ApiError, handler, ok, parseBody } from '@/lib/http';
import { loginSchema } from '@/lib/validation';
import { verifyPassword } from '@/lib/crypto';
import { createSession } from '@/lib/auth';
import { normalizePhone } from '@/lib/format';
import { Broker } from '@/models';

const LOCK_AFTER = 5;
const LOCK_MS = 10 * 60 * 1000;

/** Day to day broker login: username, phone or email plus password. No OTP. */
export const POST = handler(async (req) => {
  await connectDB();
  const { identifier, password, remember } = await parseBody(req, loginSchema);
  const id = identifier.trim().toLowerCase();
  const phone = normalizePhone(id);
  const broker = await Broker.findOne(id.includes('@') ? { email: id } : phone ? { $or: [{ phone }, { username: id }] } : { username: id });
  const fail = () => new ApiError(401, 'That username, phone or email and password do not match.');
  if (!broker) throw fail();
  if (broker.lockUntil && broker.lockUntil > new Date()) {
    const mins = Math.ceil((broker.lockUntil.getTime() - Date.now()) / 60000);
    throw new ApiError(429, `Too many wrong passwords. Try again in ${mins} minute${mins === 1 ? '' : 's'} or reset your password.`);
  }
  if (!(await verifyPassword(password, broker.passwordHash))) {
    broker.failedLogins += 1;
    if (broker.failedLogins >= LOCK_AFTER) {
      broker.lockUntil = new Date(Date.now() + LOCK_MS);
      broker.failedLogins = 0;
    }
    await broker.save();
    throw fail();
  }
  if (broker.status !== 'active') throw new ApiError(403, 'This account is switched off. Contact Abacus Spaces.');
  broker.failedLogins = 0;
  broker.lockUntil = null;
  await broker.save();
  await createSession('broker', broker._id, remember);
  return ok({ ok: true, redirect: '/broker' });
});
