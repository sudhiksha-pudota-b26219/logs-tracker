import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createSession, safeEqual } from '@/lib/auth';
import { getUser } from '@/lib/db';

export async function POST(req) {
  const { username = '', password = '' } = await req.json().catch(() => ({}));
  const u = String(username).trim().toLowerCase();
  const bad = () => NextResponse.json({ error: 'Wrong username or password.' }, { status: 401 });
  if (!u || !password) return bad();

  const adminU = (process.env.ADMIN_USERNAME || '').toLowerCase();
  if (adminU && u === adminU) {
    if (!process.env.ADMIN_PASSWORD || !safeEqual(password, process.env.ADMIN_PASSWORD)) return bad();
    await createSession({ username: process.env.ADMIN_USERNAME, role: 'admin' });
    return NextResponse.json({ ok: true });
  }
  const user = await getUser(u);
  if (!user || !(await bcrypt.compare(String(password), user.hash))) return bad();
  await createSession({ username: user.username, role: 'caller', pv: user.pv });
  return NextResponse.json({ ok: true });
}
