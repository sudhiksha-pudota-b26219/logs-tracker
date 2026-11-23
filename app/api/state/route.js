import { NextResponse } from 'next/server';
import { getSession, unauthorized } from '@/lib/auth';
import { getCallers, getList, getMeta } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await getSession();
  if (!me) return unauthorized();
  const callers = await getCallers();
  const [lists, meta] = await Promise.all([Promise.all(callers.map((c) => getList(c.username))), getMeta()]);
  return NextResponse.json({
    me,
    practice: meta.practice === '1',
    callers: callers.map((c, i) => ({
      username: c.username,
      name: c.name,
      contacts: Object.entries(lists[i]).map(([key, v]) => ({ key, ...v })).sort((a, b) => a.n - b.n),
    })),
  });
}
