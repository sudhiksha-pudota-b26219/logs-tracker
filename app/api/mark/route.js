import { NextResponse } from 'next/server';
import { getSession, unauthorized, forbidden } from '@/lib/auth';
import { getContact, saveContacts } from '@/lib/db';

export async function POST(req) {
  const me = await getSession();
  if (!me) return unauthorized();
  const { caller, key, status } = await req.json().catch(() => ({}));
  if (!['ok', 'np', 'todo'].includes(status) || !caller || !key) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  if (me.role !== 'admin' && me.username !== caller) return forbidden();
  const c = await getContact(caller, key);
  if (!c) return NextResponse.json({ error: 'That person is no longer on this list.' }, { status: 404 });
  const next =
    status === 'todo'
      ? { ...c, status: 'todo', at: null, tries: 0 }
      : { ...c, status, at: Date.now(), tries: status === 'np' ? (c.tries || 0) + 1 : c.tries || 0, by: me.name };
  await saveContacts(caller, { [key]: next });
  return NextResponse.json({ ok: true, contact: { key, ...next } });
}
