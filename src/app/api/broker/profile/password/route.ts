import { connectDB } from '@/lib/db';
import { apiBroker, createSession, revokeAllSessions } from '@/lib/auth';
import { ApiError, handler, ok, parseBody } from '@/lib/http';
import { passwordSchema } from '@/lib/validation';
import { hashPassword, verifyPassword } from '@/lib/crypto';
import { sendPasswordChanged } from '@/lib/mail';
import { Broker } from '@/models';
import { z } from 'zod';

export const POST = handler(async (req) => {
  await connectDB();
  const s = await apiBroker();
  const d = await parseBody(
    req,
    z.object({ current: z.string().min(1, 'Enter your current password'), password: passwordSchema, confirmPassword: z.string() }).refine((x) => x.password === x.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' }),
  );
  const b = await Broker.findById(s.broker._id);
  if (!b || !(await verifyPassword(d.current, b.passwordHash))) throw new ApiError(400, 'Your current password is not right.', { current: 'Not right' });
  b.passwordHash = await hashPassword(d.password);
  await b.save();
  await revokeAllSessions(b._id);
  await createSession('broker', b._id, true);
  sendPasswordChanged(b.email, b.fullName).catch((e) => console.error('[mail]', e));
  return ok({ ok: true });
});
