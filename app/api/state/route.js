import { NextResponse } from 'next/server';
import { getSession, unauthorized } from '@/lib/auth';
import { getCallers, getAllLists, getMeta } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await getSession();
  if (!me) return unauthorized();
  const callers = await getCallers();
  const [all, meta] = await Promise.all([getAllLists(), getMeta()]);
  return NextResponse.json({
    me,
    practice: meta.practice === '1',
    callers: callers.map((c) => ({
      username: c.username,
      name: c.name,
      contacts: Object.entries(all[c.username] || {}).map(([key, v]) => ({ key, ...v })).sort((a, b) => a.n - b.n),
    })),
  });
}
