import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getUser } from './db';

const COOKIE = 'wk_session';
// Cookies are signed with SESSION_SECRET if set; otherwise with a key derived from the
// admin password and the database token (both private), so no extra setting is needed.
const secret = () => {
  let s = process.env.SESSION_SECRET;
  if (!s) {
    const parts = [process.env.ADMIN_PASSWORD, process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN];
    if (parts.every(Boolean)) s = crypto.createHash('sha256').update('wk-session|' + parts.join('|')).digest('hex');
  }
  if (!s && process.env.NODE_ENV === 'production') throw new Error('Set ADMIN_PASSWORD and connect the database first.');
  return new TextEncoder().encode(s || 'dev-only-secret-change-me');
};

export async function createSession(payload) {
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret());
  (await cookies()).set(COOKIE, jwt, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

// Returns {username, name, role} or null. Callers are re-checked against the database,
// so removing a caller or resetting their password (pv bump) logs them out.
export async function getSession() {
  const jwt = (await cookies()).get(COOKIE)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret());
    if (payload.role === 'admin') {
      if (payload.username !== process.env.ADMIN_USERNAME) return null;
      return { username: payload.username, name: 'Organiser', role: 'admin' };
    }
    const u = await getUser(payload.username);
    if (!u || u.pv !== payload.pv) return null;
    return { username: u.username, name: u.name, role: 'caller' };
  } catch {
    return null;
  }
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export const unauthorized = () => NextResponse.json({ error: 'Please log in again.' }, { status: 401 });
export const forbidden = () => NextResponse.json({ error: 'Not allowed.' }, { status: 403 });

export async function requireAdmin() {
  const s = await getSession();
  return s?.role === 'admin' ? s : null;
}

const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
export function makePassword(len = 8) {
  let p = '';
  for (let i = 0; i < len; i++) p += ALPHA[crypto.randomInt(ALPHA.length)];
  return p;
}
