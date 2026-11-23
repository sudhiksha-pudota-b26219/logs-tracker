import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const me = await getSession();
  if (!me) redirect('/login');
  return <Dashboard me={me} />;
}
