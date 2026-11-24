import { NextResponse } from 'next/server';
import { requireAdmin, forbidden } from '@/lib/auth';
import { getCallers, getList, saveContacts } from '@/lib/db';

// Start a new round: everyone back to "yet to call", lists unchanged.
export async function POST() {
  if (!(await requireAdmin())) return forbidden();
  for (const c of await getCallers()) {
    const list = await getList(c.username);
    const reset = Object.fromEntries(Object.entries(list).map(([k, v]) => [k, { ...v, status: 'todo', at: null, tries: 0, by: undefined, cbTime: null, cbNote: null }]));
    await saveContacts(c.username, reset);
  }
  return NextResponse.json({ ok: true });
}
