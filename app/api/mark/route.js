import { NextResponse } from 'next/server';
import { getSession, unauthorized, forbidden } from '@/lib/auth';
import { getContact, saveContacts } from '@/lib/db';

// Statuses: todo (yet to call), ok (called), np (not picked), cb (picked up, wants a call back at cbTime).
export async function POST(req) {
  const me = await getSession();
  if (!me) return unauthorized();
  const { caller, key, status, cbTime = '', cbNote = '' } = await req.json().catch(() => ({}));
  if (!['ok', 'np', 'todo', 'cb'].includes(status) || !caller || !key) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  if (status === 'cb' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(cbTime))) return NextResponse.json({ error: 'Choose the time they want to be called back.' }, { status: 400 });
  if (me.role !== 'admin' && me.username !== caller) return forbidden();
  const c = await getContact(caller, key);
  if (!c) return NextResponse.json({ error: 'That person is no longer on this list.' }, { status: 404 });
  let next;
  if (status === 'todo') next = { ...c, status: 'todo', at: null, tries: 0, cbTime: null, cbNote: null };
  else if (status === 'cb') next = { ...c, status: 'cb', at: Date.now(), cbTime: String(cbTime), cbNote: String(cbNote).trim().slice(0, 140), by: me.name };
  // Marking "called" or "not picked" keeps any earlier call-back request, so the list can show it was asked for.
  else next = { ...c, status, at: Date.now(), tries: status === 'np' ? (c.tries || 0) + 1 : c.tries || 0, by: me.name };
  await saveContacts(caller, { [key]: next });
  return NextResponse.json({ ok: true, contact: { key, ...next } });
}
