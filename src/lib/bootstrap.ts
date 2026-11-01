import 'server-only';
import mongoose from 'mongoose';
import { getEnv } from './env';
import { hashPassword, keyedHash } from './crypto';
import { ensureSettings } from './settings';
import { Admin } from '@/models';

/**
 * Runs once per server process after the database connects.
 * - Builds indexes (unique emails, codes, pitch pairs and so on).
 * - Creates admin accounts from ADMIN_EMAIL_n / ADMIN_PASSWORD_n. A password is only
 *   re-hashed when the value in the environment changes, so an admin who resets their
 *   password from the app keeps it until the environment value is changed on purpose.
 * - Seeds the Settings document (cities, micro markets, SOP text, weekly target).
 */
export async function bootstrap(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  await syncAdmins();
  await ensureSettings();
}

export async function syncAdmins(): Promise<void> {
  const { admins } = getEnv();
  for (const a of admins) {
    const fingerprint = keyedHash(`admin-env:${a.email}:${a.password}`);
    const existing = await Admin.findOne({ email: a.email });
    if (!existing) {
      await Admin.create({ name: a.name, email: a.email, passwordHash: await hashPassword(a.password), envFingerprint: fingerprint });
      console.info(`[abacus] admin account created for ${a.email}`);
    } else if (existing.envFingerprint !== fingerprint) {
      existing.passwordHash = await hashPassword(a.password);
      existing.envFingerprint = fingerprint;
      existing.failedLogins = 0;
      existing.lockUntil = null;
      await existing.save();
      console.info(`[abacus] admin password re-synced from environment for ${a.email}`);
    }
  }
}
