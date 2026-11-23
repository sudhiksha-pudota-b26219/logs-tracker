import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { requireAdmin, forbidden, makePassword } from '@/lib/auth';
import { getUser, saveUser } from '@/lib/db';

export async function POST(req) {
  if (!(await requireAdmin())) return forbidden();
  const { username } = await req.json().catch(() => ({}));
  const u = await getUser(String(username || ''));
  if (!u) return NextResponse.json({ error: 'No such caller.' }, { status: 404 });
  const password = makePassword();
  u.hash = await bcrypt.hash(password, 10);
  u.pv = crypto.randomUUID();
  await saveUser(u);
  return NextResponse.json({ name: u.name, username: u.username, password });
}
