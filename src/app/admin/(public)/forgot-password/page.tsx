import type { Metadata } from 'next';
import { ForgotForm } from '@/components/auth/ForgotForm';

export const metadata: Metadata = { title: 'Admin password reset' };

export default function AdminForgot() {
  return <ForgotForm role="admin" whatsapp={false} />;
}
