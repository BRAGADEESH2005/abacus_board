import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { whatsappEnabled } from '@/lib/env';
import { getSettings } from '@/lib/settings';
import { SignupForm } from '@/components/auth/SignupForm';

export const metadata: Metadata = { title: 'Broker sign up' };
export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  const s = await getSession().catch(() => null);
  if (s?.type === 'broker') redirect('/broker');
  await connectDB();
  const settings = await getSettings();
  return <SignupForm cities={settings.cities.filter((c) => c.enabled).map((c) => c.name)} whatsapp={whatsappEnabled()} />;
}
