import type { Metadata } from 'next';
import { pageBroker } from '@/lib/auth';
import { loadBrokerProperties, loadBrokerSuggestions, loadOpenRequirements } from '@/lib/services/brokerData';
import { MyProperties } from '@/components/broker/MyProperties';

export const metadata: Metadata = { title: 'My properties' };

export default async function MyPropertiesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { broker } = await pageBroker();
  const sp = await searchParams;
  const [props, open, sugg] = await Promise.all([loadBrokerProperties(broker._id), loadOpenRequirements(), loadBrokerSuggestions(broker._id)]);
  return (
    <main className="page">
      <MyProperties properties={props} requirements={open.requirements} suggested={sugg.map((s) => `${s.propertyId}|${s.requirementId}`)} initialFilter={sp.filter ?? 'all'} />
    </main>
  );
}
