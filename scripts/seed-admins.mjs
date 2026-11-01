// Optional: create or re-sync admin accounts from .env without starting the server.
// Usage: npm run seed:admins   (reads .env through node --env-file)
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';

const { MONGODB_URI, MONGODB_DB, AUTH_SESSION_SECRET } = process.env;
if (!MONGODB_URI || !MONGODB_DB || !AUTH_SESSION_SECRET) {
  console.error('MONGODB_URI, MONGODB_DB and AUTH_SESSION_SECRET must be set in .env');
  process.exit(1);
}
await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });
const admins = mongoose.connection.db.collection('admins');
await admins.createIndex({ email: 1 }, { unique: true });
let n = 0;
for (let i = 1; i <= 3; i++) {
  const email = (process.env[`ADMIN_EMAIL_${i}`] ?? '').trim().toLowerCase();
  const password = process.env[`ADMIN_PASSWORD_${i}`] ?? '';
  if (!email || !password) continue;
  if (password.length < 10) { console.error(`ADMIN_PASSWORD_${i} must be at least 10 characters`); process.exit(1); }
  const name = (process.env[`ADMIN_NAME_${i}`] ?? '').trim() || email.split('@')[0];
  // Same fingerprint the app uses, so the server will not re-hash on next start.
  const envFingerprint = createHash('sha256').update(`${AUTH_SESSION_SECRET}:admin-env:${email}:${password}`).digest('hex');
  const existing = await admins.findOne({ email });
  if (existing && existing.envFingerprint === envFingerprint) { console.log(`unchanged  ${email}`); continue; }
  const passwordHash = await bcrypt.hash(password, 12);
  await admins.updateOne(
    { email },
    { $set: { passwordHash, envFingerprint, failedLogins: 0, lockUntil: null, updatedAt: new Date() },
      $setOnInsert: { name, email, emailVerifiedAt: null, trustedDevices: [], createdAt: new Date() } },
    { upsert: true },
  );
  console.log(`${existing ? 'updated' : 'created'}    ${email}`);
  n++;
}
console.log(`done (${n} changed)`);
await mongoose.disconnect();
