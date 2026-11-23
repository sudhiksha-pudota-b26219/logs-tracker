import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { getSession, unauthorized, createSession, MIN_PASSWORD } from '@/lib/auth';
import { getUser, saveUser } from '@/lib/db';

export async function POST(req) {
  const me = await getSession();
  if (!me) return unauthorized();
  if (me.role === 'admin') return NextResponse.json({ error: 'The organiser password is set in Vercel (ADMIN_PASSWORD).' }, { status: 400 });
  const { current = '', next = '' } = await req.json().catch(() => ({}));
  if (String(next).trim().length < MIN_PASSWORD) return NextResponse.json({ error: `New password must be at least ${MIN_PASSWORD} characters.` }, { status: 400 });
  const u = await getUser(me.username);
  if (!u || !(await bcrypt.compare(String(current), u.hash))) return NextResponse.json({ error: 'Current password is wrong.' }, { status: 400 });
  u.hash = await bcrypt.hash(String(next).trim(), 10);
  u.pv = crypto.randomUUID();
  await saveUser(u);
  await createSession({ username: u.username, role: 'caller', pv: u.pv });
  return NextResponse.json({ ok: true });
}
