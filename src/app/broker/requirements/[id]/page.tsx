import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageBroker } from '@/lib/auth';
import { isId } from '@/lib/http';
import { getEnv } from '@/lib/env';
import { Requirement, SavedRequirement, Suggestion, type RequirementDoc } from '@/models';
import { publicRequirement } from '@/lib/services/publicReq';
import { loadBrokerProperties, rankOwnForRequirement, suggestionResponse } from '@/lib/services/brokerData';
import { RequirementDetail } from '@/components/broker/RequirementDetail';

export const metadata: Metadata = { title: 'Requirement' };

export default async function BrokerRequirement({ params }: { params: Promise<{ id: string }> }) {
  const { broker } = await pageBroker();
  const { id } = await params;
  if (!isId(id)) notFound();
  const doc = await Requirement.findById(id).lean<RequirementDoc>();
  if (!doc) notFound();
  const r = publicRequirement(doc);
  if (r.status !== 'open') {
    return (
      <main className="page narrow">
        <div className="empty">
          <b>{r.code} is no longer open</b>
          Abacus has closed or paused this requirement.
          <div style={{ marginTop: 12 }}>
            <Link className="btn" href="/broker/requirements">
              See open requirements
            </Link>
          </div>
        </div>
      </main>
    );
  }
  const [props, saved, mine] = await Promise.all([
    loadBrokerProperties(broker._id),
    SavedRequirement.exists({ broker: broker._id, requirement: doc._id }),
    Suggestion.find({ broker: broker._id, requirement: doc._id }).sort({ createdAt: -1 }).lean(),
  ]);
  const codeOf = new Map(props.map((p) => [p.id, p.code]));
  const ranked = rankOwnForRequirement(r, props).map((x) => ({ id: x.property.id, code: x.property.code, place: `${x.property.microMarket}, ${x.property.city}`, carpet: x.property.carpetArea, rent: x.property.rent, fit: x.fit }));
  const suggested = mine.map((s) => ({ id: String(s._id), propertyId: String(s.property), code: codeOf.get(String(s.property)) ?? '', note: s.note, createdAt: new Date(s.createdAt).toISOString(), response: suggestionResponse(s) }));
  return (
    <main className="page narrow">
      <p className="muted" style={{ marginTop: 0 }}>
        <Link href="/broker/requirements">← All requirements</Link>
      </p>
      <RequirementDetail r={r} saved={Boolean(saved)} picker={ranked} suggestions={suggested} url={`${getEnv().APP_URL}/broker/requirements/${r.id}`} />
    </main>
  );
}
