import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Types } from 'mongoose';
import { connectDB } from './db';
import { keyedHash, randomToken } from './crypto';
import { SESSION_TTL_MS, SHORT_SESSION_TTL_MS } from './constants';
import { Admin, Broker, Session, type AdminDoc, type BrokerDoc } from '@/models';
import { ApiError } from './http';

export const SESSION_COOKIE = 'abd_session';
export const DEVICE_COOKIE = 'abd_device';

const secure = process.env.NODE_ENV === 'production';

export type AdminSession = { type: 'admin'; admin: AdminDoc; sessionId: Types.ObjectId };
export type BrokerSession = { type: 'broker'; broker: BrokerDoc; sessionId: Types.ObjectId };
export type AnySession = AdminSession | BrokerSession;

export async function createSession(userType: 'admin' | 'broker', userId: Types.ObjectId, persistent: boolean) {
  await connectDB();
  const token = randomToken(32);
  const ttl = persistent ? SESSION_TTL_MS : SHORT_SESSION_TTL_MS;
  const h = await headers();
  await Session.create({
    tokenHash: keyedHash(`session:${token}`),
    userType,
    userId,
    persistent,
    expiresAt: new Date(Date.now() + ttl),
    userAgent: (h.get('user-agent') ?? '').slice(0, 300),
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    // Persistent sessions survive closing the browser for 30 days; others end with the browser.
    ...(persistent ? { maxAge: Math.floor(ttl / 1000) } : {}),
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await connectDB();
    await Session.deleteOne({ tokenHash: keyedHash(`session:${token}`) });
  }
  jar.delete(SESSION_COOKIE);
}

export async function revokeAllSessions(userId: Types.ObjectId) {
  await connectDB();
  await Session.deleteMany({ userId });
}

export async function getSession(): Promise<AnySession | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await connectDB();
  const s = await Session.findOne({ tokenHash: keyedHash(`session:${token}`) });
  if (!s || s.expiresAt < new Date()) return null;
  // Sliding refresh: keep persistent sessions alive while they are used.
  if (Date.now() - s.lastSeenAt.getTime() > 60 * 60 * 1000) {
    s.lastSeenAt = new Date();
    if (s.persistent) s.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await s.save();
  }
  if (s.userType === 'admin') {
    const admin = await Admin.findById(s.userId).lean<AdminDoc>();
    return admin ? { type: 'admin', admin, sessionId: s._id } : null;
  }
  const broker = await Broker.findById(s.userId).lean<BrokerDoc>();
  if (!broker || broker.status !== 'active') return null;
  return { type: 'broker', broker, sessionId: s._id };
}

/* For server components and pages: redirect when not allowed. */
export async function pageAdmin(): Promise<AdminSession> {
  const s = await getSession();
  if (!s || s.type !== 'admin') redirect('/admin/login');
  return s;
}
export async function pageBroker(): Promise<BrokerSession> {
  const s = await getSession();
  if (!s || s.type !== 'broker') redirect('/login');
  return s;
}

/* For API routes: throw 401/403 JSON errors. */
export async function apiAdmin(): Promise<AdminSession> {
  const s = await getSession();
  if (!s) throw new ApiError(401, 'Please log in again.');
  if (s.type !== 'admin') throw new ApiError(403, 'Admins only.');
  return s;
}
export async function apiBroker(): Promise<BrokerSession> {
  const s = await getSession();
  if (!s) throw new ApiError(401, 'Please log in again.');
  if (s.type !== 'broker') throw new ApiError(403, 'Brokers only.');
  return s;
}

/* Trusted browser cookie for admin "OTP only on a new browser". */
export async function getDeviceId(): Promise<string | null> {
  return (await cookies()).get(DEVICE_COOKIE)?.value ?? null;
}
export async function ensureDeviceId(): Promise<string> {
  const jar = await cookies();
  let id = jar.get(DEVICE_COOKIE)?.value;
  if (!id) {
    id = randomToken(24);
    jar.set(DEVICE_COOKIE, id, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 400 * 24 * 60 * 60 });
  }
  return id;
}
export function deviceHash(id: string) {
  return keyedHash(`device:${id}`);
}
