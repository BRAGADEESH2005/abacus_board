import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { BrokerLoginForm } from '@/components/auth/BrokerLoginForm';

export const metadata: Metadata = { title: 'Broker login' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const s = await getSession().catch(() => null);
  if (s?.type === 'broker') redirect('/broker');
  return <BrokerLoginForm />;
}
