import type { Metadata } from 'next';
import { pageAdmin } from '@/lib/auth';
import { getSettings, microMarketOf } from '@/lib/settings';
import { loadBoard } from '@/lib/services/board';
import { propView } from '@/lib/services/adminView';
import { AdminMapView } from '@/components/admin/AdminMapView';

export const metadata: Metadata = { title: 'Map' };

export default async function MapPage() {
  await pageAdmin();
  const [b, settings] = await Promise.all([loadBoard(), getSettings()]);
  const props = b.props.filter((p) => p.lat != null && p.lng != null).map((p) => propView(b, p));
  // One shaded circle per micro market with open requirements, labelled with how many brands want it.
  const groups = new Map<string, Set<string>>();
  for (const r of b.reqs.filter((r) => r.status === 'open')) {
    const k = `${r.city}|${r.microMarket}`;
    if (!groups.has(k)) groups.set(k, new Set());
    groups.get(k)!.add(r.brand._id.toString());
  }
  const circles = [...groups.entries()]
    .map(([k, brands]) => {
      const [city, mm] = k.split('|') as [string, string];
      const m = microMarketOf(settings, city, mm);
      if (!m || m.lat == null || m.lng == null) return null;
      return { key: k, city, microMarket: mm, lat: m.lat, lng: m.lng, radius: m.radiusM || 1200, brands: brands.size };
    })
    .filter(Boolean) as { key: string; city: string; microMarket: string; lat: number; lng: number; radius: number; brands: number }[];
  return (
    <main className="page" style={{ maxWidth: 1400 }}>
      <h1>Map</h1>
      <p className="lead">Every broker property as a dot coloured by stage, and open requirements as shaded micro market areas, so demand with no supply nearby stands out.</p>
      <AdminMapView props={props} circles={circles} brokers={b.brokers.map((x) => ({ id: x._id.toString(), label: `${x.fullName} (@${x.username})` }))} />
    </main>
  );
}
