import type { Metadata } from 'next';
import { pageBroker } from '@/lib/auth';
import { loadOpenRequirements, savedIds } from '@/lib/services/brokerData';
import { RequirementsBoard } from '@/components/broker/RequirementsBoard';

export const metadata: Metadata = { title: 'Requirements' };

export default async function RequirementsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { broker } = await pageBroker();
  const sp = await searchParams;
  const [{ requirements, demand }, saved] = await Promise.all([loadOpenRequirements(), savedIds(broker._id)]);
  const myCities = [...new Set([broker.city, ...(broker.microMarkets ?? []).map((m) => m.city)])];
  return (
    <main className="page">
      <RequirementsBoard
        requirements={requirements}
        demand={demand}
        saved={saved}
        myCities={myCities}
        initial={{ city: sp.city ?? '', mm: sp.mm ?? '', saved: sp.saved === '1', mine: sp.mine === '1' }}
      />
    </main>
  );
}
