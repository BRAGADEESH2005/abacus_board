import type { Metadata } from 'next';
import { pageBroker } from '@/lib/auth';
import { getSettings, locationLists } from '@/lib/settings';
import { Property } from '@/models';
import { StartProperty } from '@/components/broker/StartProperty';

export const metadata: Metadata = { title: 'Post a property' };

export default async function NewProperty({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { broker } = await pageBroker();
  const sp = await searchParams;
  const settings = await getSettings();
  const drafts = await Property.find({ broker: broker._id, state: 'draft' }).sort({ updatedAt: -1 }).select('code city microMarket updatedAt').lean();
  return (
    <main className="page narrow">
      <h1>Post a property</h1>
      <p className="lead">
        Pick where it is. The board reserves a property code straight away so you can name the Drive folder, and saves your draft as you go. Name, phone and email come from your profile.
      </p>
      <StartProperty
        locations={locationLists(settings)}
        defaultCity={sp.city ?? broker.city}
        defaultMm={sp.mm ?? ''}
        suggestFor={sp.suggestFor ?? ''}
        drafts={drafts.map((d) => ({ id: String(d._id), code: d.code, place: [d.microMarket, d.city].filter(Boolean).join(', '), updatedAt: new Date(d.updatedAt).toISOString() }))}
      />
    </main>
  );
}
