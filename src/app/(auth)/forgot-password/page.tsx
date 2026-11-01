import type { Metadata } from 'next';
import { whatsappEnabled } from '@/lib/env';
import { ForgotForm } from '@/components/auth/ForgotForm';

export const metadata: Metadata = { title: 'Reset password' };
export const dynamic = 'force-dynamic';

export default function ForgotPage() {
  return <ForgotForm role="broker" whatsapp={whatsappEnabled()} />;
}
