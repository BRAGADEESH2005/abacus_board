import Link from 'next/link';
import { pageBroker } from '@/lib/auth';
import { NavTabs } from '@/components/NavTabs';
import { UserMenu } from '@/components/UserMenu';
import { Avatar } from '@/components/ui/Avatar';

export const dynamic = 'force-dynamic';

export default async function BrokerLayout({ children }: { children: React.ReactNode }) {
  const { broker } = await pageBroker();
  const cities = [...new Set([broker.city, ...(broker.microMarkets ?? []).map((m) => m.city)])];
  return (
    <>
      <header className="appbar">
        <div className="hin">
          <Link className="logo" href="/broker">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/abacus-logo.png" alt="Abacus Spaces" />
          </Link>
          <span className="t">
            <b>Requirement Board</b>
            <span>Broker</span>
          </span>
          <div className="who">
            <UserMenu
              loginPath="/login"
              links={[{ href: '/broker/profile', label: 'My profile' }]}
              trigger={
                <>
                  <span className="whotext">
                    Signed in as <b>{broker.fullName}</b> · {cities.join(', ')}
                  </span>
                  <Avatar name={broker.fullName} fileId={broker.avatarFileId ? String(broker.avatarFileId) : null} size={32} />
                </>
              }
            />
          </div>
        </div>
        <NavTabs
          items={[
            { href: '/broker', label: 'Dashboard', exact: true },
            { href: '/broker/requirements', label: 'Requirements' },
            { href: '/broker/properties/new', label: 'Post a property', exact: true },
            { href: '/broker/properties', label: 'My properties', exact: true },
            { href: '/broker/suggestions', label: 'My suggestions' },
          ]}
        />
      </header>
      {children}
    </>
  );
}
