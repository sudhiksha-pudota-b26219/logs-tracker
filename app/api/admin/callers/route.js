import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { requireAdmin, forbidden, makePassword } from '@/lib/auth';
import { getUsers, saveUser } from '@/lib/db';

// Add callers from a list of names. Returns their new usernames and passwords (shown once).
export async function POST(req) {
  if (!(await requireAdmin())) return forbidden();
  const { names = [] } = await req.json().catch(() => ({}));
  const clean = names.map((n) => String(n).trim()).filter(Boolean).slice(0, 100);
  if (!clean.length) return NextResponse.json({ error: 'Add at least one name.' }, { status: 400 });
  const users = await getUsers();
  const taken = new Set([...Object.keys(users), (process.env.ADMIN_USERNAME || '').toLowerCase()]);
  let order = Math.max(-1, ...Object.values(users).map((u) => u.order ?? -1)) + 1;
  const created = [];
  for (const name of clean) {
    const base = (name.split(/\s+/)[0].toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '').slice(0, 12)) || 'caller';
    let username = base, i = 2;
    while (taken.has(username)) username = base + i++;
    taken.add(username);
    const password = makePassword();
    await saveUser({ username, name, role: 'caller', order: order++, hash: await bcrypt.hash(password, 10), pv: crypto.randomUUID() });
    created.push({ name, username, password });
  }
  return NextResponse.json({ created });
}
