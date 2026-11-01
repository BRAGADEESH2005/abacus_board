import 'server-only';
import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => (v ?? '').trim().toLowerCase() === 'true');

const schema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB: z.string().min(1, 'MONGODB_DB is required'),
  AUTH_SESSION_SECRET: z.string().min(32, 'AUTH_SESSION_SECRET must be at least 32 characters'),
  EMAIL_HOST: z.string().min(1, 'EMAIL_HOST is required'),
  EMAIL_PORT: z.coerce.number().int().positive('EMAIL_PORT must be a port number'),
  EMAIL_SECURE: bool,
  EMAIL_USER: z.string().min(1, 'EMAIL_USER is required'),
  EMAIL_PASSWORD: z.string().min(1, 'EMAIL_PASSWORD is required'),
  EMAIL_FROM: z.string().min(1, 'EMAIL_FROM is required'),
  APP_URL: z.string().url().optional().or(z.literal('')).transform((v) => v || 'http://localhost:3000'),
  CRON_SECRET: z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(''),
  WHATSAPP_OTP_TEMPLATE: z.string().optional().default(''),
  WHATSAPP_TEMPLATE_LANG: z.string().optional().default('en'),
});

export type Env = z.infer<typeof schema> & {
  admins: { email: string; password: string; name: string }[];
};

let cached: Env | null = null;

function readAdmins(): { email: string; password: string; name: string }[] {
  const admins: { email: string; password: string; name: string }[] = [];
  const problems: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const email = (process.env[`ADMIN_EMAIL_${i}`] ?? '').trim().toLowerCase();
    const password = process.env[`ADMIN_PASSWORD_${i}`] ?? '';
    const name = (process.env[`ADMIN_NAME_${i}`] ?? '').trim();
    if (!email && !password) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push(`ADMIN_EMAIL_${i} is not a valid email`);
    if (password.length < 10) problems.push(`ADMIN_PASSWORD_${i} must be at least 10 characters`);
    admins.push({ email, password, name: name || email.split('@')[0] });
  }
  if (admins.length === 0) problems.push('At least one admin is required (ADMIN_EMAIL_1 and ADMIN_PASSWORD_1)');
  if (problems.length) throw new Error(`Invalid admin configuration:\n  - ${problems.join('\n  - ')}`);
  return admins;
}

/** Validates and returns the environment. Throws a readable error listing every problem. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Missing or invalid environment variables:\n  - ${lines.join('\n  - ')}\nSee .env.example.`);
  }
  cached = { ...parsed.data, admins: readAdmins() };
  return cached;
}

export function whatsappEnabled(): boolean {
  const e = getEnv();
  return Boolean(e.WHATSAPP_PHONE_NUMBER_ID && e.WHATSAPP_ACCESS_TOKEN && e.WHATSAPP_OTP_TEMPLATE);
}
