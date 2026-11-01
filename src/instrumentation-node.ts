import { getEnv } from './lib/env';
import { connectDB } from './lib/db';

/**
 * Validates the environment so a missing variable fails loudly at boot, then connects to
 * MongoDB, which builds indexes, initialises the admin accounts from ADMIN_EMAIL_n /
 * ADMIN_PASSWORD_n and seeds Settings.
 */
export async function startup() {
  try {
    getEnv();
  } catch (err) {
    console.error(`\n[abacus] ${err instanceof Error ? err.message : err}\n`);
    throw err;
  }
  try {
    await connectDB();
    console.info('[abacus] database connected, admins initialised');
  } catch (err) {
    // Keep the server up so pages can show a friendly error; requests retry the connection.
    console.error('[abacus] startup database check failed:', err instanceof Error ? err.message : err);
  }
}
