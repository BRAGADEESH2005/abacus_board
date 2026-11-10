import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageBroker } from '@/lib/auth';
import { isId } from '@/lib/http';
import { getSettings, locationLists } from '@/lib/settings';
import { brokerProperty } from '@/lib/services/brokerData';
import { Pitch, Property, Requirement, type PitchDoc, type PropertyDoc } from '@/models';
import { PropertyForm } from '@/components/broker/PropertyForm';
import { StageBadge } from '@/components/ui/Badges';

export const metadata: Metadata = { title: 'Property' };

export default async function EditProperty({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { broker } = await pageBroker();
  const { id } = await params;
  const sp = await searchParams;
  if (!isId(id)) notFound();
  const doc = await Property.findById(id).lean<PropertyDoc>();
  if (!doc || String(doc.broker) !== String(broker._id) || doc.deletedAt) notFound();
  const [pitches, settings, r] = await Promise.all([
    Pitch.find({ property: doc._id }).select('stage stageNote createdAt property').lean<PitchDoc[]>(),
    getSettings(),
    sp.suggestFor && isId(sp.suggestFor) ? Requirement.findById(sp.suggestFor).select('code status').lean() : Promise.resolve(null),
  ]);
  const p = brokerProperty(doc, pitches);
  const suggestFor: { id: string; code: string } | null = r && r.status === 'open' ? { id: String(r._id), code: r.code } : null;
  if (doc.state === 'merged') {
    return (
      <main className="page narrow">
        <div className="empty">
          <b>{doc.code} was merged by Abacus</b>
          It matched an earlier listing of the same space and is kept for the record.
          <div style={{ marginTop: 12 }}>
            <Link className="btn" href="/broker/properties">
              Back to my properties
            </Link>
          </div>
        </div>
      </main>
    );
  }
  return (
    <main className="page narrow">
      <p className="muted" style={{ marginTop: 0 }}>
        <Link href="/broker/properties">← My properties</Link>
      </p>
      <div className="pagehead">
        <div>
          <h1>{p.state === 'draft' ? 'Post a property' : `Edit ${p.code}`}</h1>
          <p className="lead">Fields marked * are required. Fields appear only when they apply.</p>
        </div>
        {p.state === 'submitted' && <StageBadge stage={p.stage} />}
      </div>
      <PropertyForm
        property={p}
        locations={locationLists(settings)}
        texts={{ sopIntro: settings.sopIntro, sopShots: settings.sopShots, sopFolders: settings.sopFolders, sopShare: settings.sopShare, sopLink: settings.sopLink, notesHelp: settings.notesHelp }}
        measureVideoUrl={settings.measureVideoUrl}
        drawVideoUrl={settings.drawVideoUrl ?? ''}
        suggestFor={suggestFor}
      />
    </main>
  );
}
