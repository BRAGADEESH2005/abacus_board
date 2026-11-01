import Link from 'next/link';
import { pageAdmin } from '@/lib/auth';
import { runDueJobs } from '@/lib/services/jobs';
import { NavTabs } from '@/components/NavTabs';
import { UserMenu } from '@/components/UserMenu';
import { Bell } from '@/components/admin/Bell';
import { Avatar } from '@/components/ui/Avatar';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await pageAdmin();
  // Daily jobs (stale listings, red flags, 9 am summary) run here when due; throttled per process.
  await runDueJobs().catch((e) => console.error('[jobs]', e));
  return (
    <>
      <header className="appbar">
        <div className="hin">
          <Link className="logo" href="/admin">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/abacus-logo.png" alt="Abacus Spaces" />
          </Link>
          <span className="t">
            <b>Requirement Board</b>
            <span>Admin</span>
          </span>
          <div className="who">
            <Bell />
            <UserMenu
              loginPath="/admin/login"
              links={[{ href: '/admin/settings', label: 'Settings' }, { href: '/admin/notifications', label: 'Notification history' }]}
              trigger={
                <>
                  <span className="whotext">
                    Signed in as <b>{s.admin.name}</b>
                  </span>
                  <Avatar name={s.admin.name} size={32} />
                </>
              }
            />
          </div>
        </div>
        <NavTabs
          items={[
            { href: '/admin', label: 'Dashboard', exact: true },
            { href: '/admin/requirements', label: 'Requirements' },
            { href: '/admin/properties', label: 'Properties' },
            { href: '/admin/map', label: 'Map' },
            { href: '/admin/demand', label: 'Demand tracker' },
            { href: '/admin/brands', label: 'Brands' },
            { href: '/admin/brokers', label: 'Brokers' },
            { href: '/admin/settings', label: 'Settings' },
          ]}
        />
      </header>
      {children}
    </>
  );
}
