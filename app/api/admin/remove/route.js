import { NextResponse } from 'next/server';
import { requireAdmin, forbidden } from '@/lib/auth';
import { removeUser } from '@/lib/db';

export async function POST(req) {
  if (!(await requireAdmin())) return forbidden();
  const { username } = await req.json().catch(() => ({}));
  if (!username) return NextResponse.json({ error: 'No caller given.' }, { status: 400 });
  await removeUser(String(username));
  return NextResponse.json({ ok: true });
}
