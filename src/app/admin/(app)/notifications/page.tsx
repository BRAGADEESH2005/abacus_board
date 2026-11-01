import type { Metadata } from 'next';
import { pageAdmin } from '@/lib/auth';
import { NotificationHistory } from '@/components/admin/NotificationHistory';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  await pageAdmin();
  return (
    <main className="page narrow">
      <h1>Notifications</h1>
      <p className="lead">Red flags are checked every day. The daily summary lands at 9 am India time with yesterday&apos;s numbers, and every past day stays here on record.</p>
      <NotificationHistory />
    </main>
  );
}
