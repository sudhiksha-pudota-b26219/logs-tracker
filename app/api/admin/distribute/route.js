import { NextResponse } from 'next/server';
import { requireAdmin, forbidden } from '@/lib/auth';
import { getCallers, getList, replaceList, setMeta } from '@/lib/db';

// Replace every caller's list: people are split into even consecutive blocks, in caller order.
// Anyone already on a list (same roll number, or same name when there's no roll number) keeps
// their current call status, so fixing a typo or adding a few names doesn't wipe progress.
export async function POST(req) {
  if (!(await requireAdmin())) return forbidden();
  const { people = [], practice = false } = await req.json().catch(() => ({}));
  const list = people
    .map((p) => ({ name: String(p.name || '').trim().slice(0, 120), roll: String(p.roll || '').trim().slice(0, 40) }))
    .filter((p) => p.name)
    .slice(0, 5000);
  const callers = await getCallers();
  if (!callers.length) return NextResponse.json({ error: 'Add callers first.' }, { status: 400 });
  if (!list.length) return NextResponse.json({ error: 'Add the people to call.' }, { status: 400 });

  const idOf = (p) => (p.roll ? 'r:' + p.roll.toLowerCase() : 'n:' + p.name.toLowerCase());
  const previous = new Map();
  for (const c of callers) for (const v of Object.values(await getList(c.username))) previous.set(idOf(v), v);

  const base = Math.floor(list.length / callers.length), extra = list.length % callers.length;
  let idx = 0, n = 0, kept = 0;
  for (let i = 0; i < callers.length; i++) {
    const size = base + (i < extra ? 1 : 0), contacts = {};
    for (let j = 0; j < size; j++) {
      const p = list[idx++]; n++;
      const old = previous.get(idOf(p));
      const st = old && old.status !== 'todo' ? { status: old.status, at: old.at, tries: old.tries || 0, by: old.by, cbTime: old.cbTime || null, cbNote: old.cbNote || null } : { status: 'todo', at: null, tries: 0 };
      if (old && old.status !== 'todo') kept++;
      contacts['k' + String(n).padStart(4, '0')] = { n, name: p.name, roll: p.roll, ...st };
    }
    await replaceList(callers[i].username, contacts);
  }
  await setMeta({ practice: practice ? '1' : '0', updatedAt: String(Date.now()) });
  return NextResponse.json({ ok: true, total: list.length, callers: callers.length, kept });
}
