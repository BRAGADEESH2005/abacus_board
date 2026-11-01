import type { Metadata } from 'next';
import { pageAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { whatsappEnabled } from '@/lib/env';
import { SettingsForm } from '@/components/admin/SettingsForm';
import { LocationsManager } from '@/components/admin/LocationsManager';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const s = await pageAdmin();
  const settings = await getSettings();
  return (
    <main className="page">
      <h1>Settings</h1>
      <p className="lead">
        Only admins can change these. The location lists feed every dropdown on the broker and admin sides. Signed in as {s.admin.name} ({s.admin.email}). WhatsApp OTP is {whatsappEnabled() ? 'on' : 'off (set the WHATSAPP_* environment variables to switch it on)'}.
      </p>
      <SettingsForm
        initial={{
          weeklyTarget: settings.weeklyTarget,
          sopLink: settings.sopLink,
          sopIntro: settings.sopIntro,
          sopShots: settings.sopShots,
          sopFolders: settings.sopFolders,
          sopShare: settings.sopShare,
          notesHelp: settings.notesHelp,
          measureVideoUrl: settings.measureVideoUrl,
          levels: settings.levels.map((l) => ({ key: l.key, name: l.name, threshold: l.threshold })),
        }}
      />
      <h2>Cities, micro markets and stretches</h2>
      <LocationsManager
        initial={settings.cities.map((c) => ({
          id: String(c._id),
          name: c.name,
          code: c.code,
          state: c.state,
          lat: c.lat ?? null,
          lng: c.lng ?? null,
          enabled: c.enabled,
          microMarkets: c.microMarkets.map((m) => ({ id: String(m._id), name: m.name, lat: m.lat, lng: m.lng, radiusM: m.radiusM, stretches: m.stretches ?? [] })),
        }))}
      />
    </main>
  );
}
