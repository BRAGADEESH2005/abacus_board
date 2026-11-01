import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { AdminLoginForm } from '@/components/auth/AdminLoginForm';

export const metadata: Metadata = { title: 'Admin login' };
export const dynamic = 'force-dynamic';

export default async function AdminLogin() {
  const s = await getSession().catch(() => null);
  if (s?.type === 'admin') redirect('/admin');
  return <AdminLoginForm />;
}
