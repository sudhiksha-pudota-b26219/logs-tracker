import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { requireAdmin, forbidden, makePassword, MIN_PASSWORD } from '@/lib/auth';
import { getUser, saveUser } from '@/lib/db';

export async function POST(req) {
  if (!(await requireAdmin())) return forbidden();
  const { username, password: chosen = '' } = await req.json().catch(() => ({}));
  const wanted = String(chosen).trim();
  if (wanted && wanted.length < MIN_PASSWORD) return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD} characters.` }, { status: 400 });
  const u = await getUser(String(username || ''));
  if (!u) return NextResponse.json({ error: 'No such caller.' }, { status: 404 });
  const password = wanted || makePassword();
  u.hash = await bcrypt.hash(password, 10);
  u.pv = crypto.randomUUID();
  await saveUser(u);
  return NextResponse.json({ name: u.name, username: u.username, password });
}
