'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { num } from '@/lib/format';
import type { BrokerProperty } from '@/lib/services/brokerData';
import type { PublicRequirement } from '@/lib/services/publicReq';
import { SuggestModal } from './MyProperties';

/** My suggestions: pick one of your active listings, then the requirements to suggest it for. */
export function SuggestFromHere({ properties, requirements, suggested }: { properties: BrokerProperty[]; requirements: PublicRequirement[]; suggested: string[] }) {
  const active = properties.filter((p) => p.state === 'submitted' && p.listingStatus === 'available');
  const [pick, setPick] = useState(active[0]?.id ?? '');
  const [open, setOpen] = useState(false);
  const sug = useMemo(() => new Set(suggested), [suggested]);
  const p = active.find((x) => x.id === pick);

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="ph">
        <h3>Suggest a property</h3>
      </div>
      <div className="pb">
        {active.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            You have no active listings to suggest. <Link href="/broker/properties/new">Post a property</Link> first, or mark one available again in <Link href="/broker/properties">My properties</Link>.
          </p>
        ) : (
          <div className="row-flex">
            <select className="input" style={{ width: 'auto', maxWidth: '100%' }} value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Your property">
              {active.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} · {[x.microMarket, x.city].filter(Boolean).join(', ')} · {num(x.carpetArea)} sq ft
                </option>
              ))}
            </select>
            <button className="btn primary small" onClick={() => setOpen(true)} disabled={!p}>
              Choose requirements
            </button>
          </div>
        )}
      </div>
      {open && p && <SuggestModal p={p} reqs={requirements} suggested={sug} onClose={() => setOpen(false)} />}
    </section>
  );
}
