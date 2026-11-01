import type { Metadata } from 'next';
import Link from 'next/link';
import { pageAdmin } from '@/lib/auth';
import { getSettings, locationLists } from '@/lib/settings';
import { RequirementWizard } from '@/components/admin/RequirementWizard';

export const metadata: Metadata = { title: 'Post a requirement' };

export default async function NewRequirement() {
  await pageAdmin();
  const settings = await getSettings();
  return (
    <main className="page">
      <p className="muted" style={{ marginTop: 0 }}>
        <Link href="/admin/requirements">← Requirements</Link>
      </p>
      <h1>Post a requirement</h1>
      <p className="lead">Fill the brand once, pick every city, micro market and stretch, and the board creates one requirement per micro market.</p>
      <RequirementWizard locations={locationLists(settings)} />
    </main>
  );
}
