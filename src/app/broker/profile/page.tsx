import type { Metadata } from 'next';
import { pageBroker } from '@/lib/auth';
import { whatsappEnabled } from '@/lib/env';
import { getSettings, levelName, locationLists } from '@/lib/settings';
import { profileCompleteness } from '@/lib/profile';
import { USERNAME_CHANGE_DAYS } from '@/lib/constants';
import { ProfileEditor } from '@/components/broker/ProfileEditor';

export const metadata: Metadata = { title: 'My profile' };

export default async function ProfilePage() {
  const { broker } = await pageBroker();
  const settings = await getSettings();
  const wa = whatsappEnabled();
  const avatar = broker.avatarFileId ? String(broker.avatarFileId) : null;
  const nextUsernameChange = broker.usernameChangedAt ? new Date(new Date(broker.usernameChangedAt).getTime() + USERNAME_CHANGE_DAYS * 86400000).toISOString() : null;
  return (
    <main className="page narrow">
      <h1>My profile</h1>
      <p className="lead">Only you and Abacus admins see this page.</p>
      <ProfileEditor
        whatsapp={wa}
        locations={locationLists(settings)}
        level={{ key: broker.level, name: levelName(settings, broker.level) }}
        ring={profileCompleteness({ ...broker, avatarFileId: avatar }, wa)}
        profile={{
          fullName: broker.fullName,
          username: broker.username,
          company: broker.company,
          city: broker.city,
          microMarkets: broker.microMarkets ?? [],
          phone: broker.phone,
          phoneVerified: broker.phoneVerified,
          email: broker.email,
          emailVerified: broker.emailVerified,
          altPhone: broker.altPhone,
          avatarFileId: avatar,
          memberSince: new Date(broker.createdAt).toISOString(),
          nextUsernameChange: nextUsernameChange && new Date(nextUsernameChange) > new Date() ? nextUsernameChange : null,
        }}
      />
    </main>
  );
}
