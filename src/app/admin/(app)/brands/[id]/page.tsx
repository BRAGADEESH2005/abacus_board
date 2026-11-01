import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageAdmin } from '@/lib/auth';
import { isId } from '@/lib/http';
import { displayPhone, fmtDate, inrShort } from '@/lib/format';
import { STAGE_RANK } from '@/lib/constants';
import { FLAG_LABEL, computeFlags, loadBoard, rowFee } from '@/lib/services/board';
import { StillActiveButton } from '@/components/admin/actions';
import { BrandEdit } from '@/components/admin/BrandEdit';
import { StageBadge } from '@/components/ui/Badges';

export const metadata: Metadata = { title: 'Brand' };

export default async function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  await pageAdmin();
  const { id } = await params;
  if (!isId(id)) notFound();
  const b = await loadBoard();
  const brand = b.brandById.get(id);
  if (!brand) notFound();
  const reqs = b.reqs.filter((r) => r.brand._id.toString() === id).sort((a, c) => a.city.localeCompare(c.city) || a.microMarket.localeCompare(c.microMarket));
  const open = reqs.filter((r) => r.status === 'open');
  const flags = computeFlags(b).filter((f) => f.req.brand._id.toString() === id);
  let closed = 0;
  let neg = 0;
  let full = 0;
  for (const r of reqs) {
    const ps = b.pitchesByReq.get(r.id) ?? [];
    closed += ps.filter((p) => p.stage === 'Closed').length * rowFee(r);
    neg += ps.filter((p) => p.stage === 'Under negotiation').length * rowFee(r);
    if (r.status === 'open') full += rowFee(r) * Math.max(0, r.storesWanted - ps.filter((p) => p.stage === 'Closed').length);
  }
  const withOptions = open.filter((r) => (b.pitchesByReq.get(r.id) ?? []).length > 0).length;

  return (
    <main className="page">
      <p className="muted" style={{ marginTop: 0 }}>
        <Link href="/admin/brands">← Brands</Link>
      </p>
      <div className="pagehead">
        <div>
          <h1>{brand.name}</h1>
          <p className="lead">
            {brand.sector}
            {brand.storeModel ? ` · ${brand.storeModel}` : ''} · {brand.contactName || 'No contact'}
            {brand.designation ? `, ${brand.designation}` : ''}
            {brand.phone ? (
              <>
                {' · '}
                <a href={`tel:${brand.phone}`}>{displayPhone(brand.phone)}</a>
              </>
            ) : null}{' '}
            · Our fee: {brand.paysNothing ? 'brand pays nothing' : `${brand.fee} days rent`} · {open.reduce((s, r) => s + r.storesWanted, 0)} stores wanted
          </p>
        </div>
        <div className="row-flex">
          <BrandEdit
            brand={{
              id,
              name: brand.name,
              sector: brand.sector,
              contactName: brand.contactName,
              designation: brand.designation,
              phone: brand.phone,
              email: brand.email,
              storeModel: brand.storeModel,
              fee: brand.fee,
              paysNothing: brand.paysNothing,
              notes: brand.notes,
            }}
          />
          <Link className="btn primary small" href="/admin/requirements/new">
            New ask
          </Link>
        </div>
      </div>
      <div className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="tile money good">
          <span className="v">{inrShort(closed)}</span>
          <span className="k">Closed</span>
        </div>
        <div className="tile money">
          <span className="v">{inrShort(neg)}</span>
          <span className="k">In negotiation</span>
        </div>
        <div className="tile money">
          <span className="v">{inrShort(full)}</span>
          <span className="k">Full potential</span>
        </div>
      </div>
      <h2>
        Options sent for {withOptions} of {open.length} open location{open.length === 1 ? '' : 's'}
      </h2>
      {reqs.length === 0 ? (
        <div className="empty">
          <b>No requirements for this brand</b>
        </div>
      ) : (
        <div className="tw">
          <table className="t">
            <thead>
              <tr>
                <th>City</th>
                <th>Micro market</th>
                <th className="num">Stores wanted</th>
                <th className="num">Properties pitched</th>
                <th>Furthest stage</th>
                <th className="num">Days since posted</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {reqs.map((r) => {
                const ps = (b.pitchesByReq.get(r.id) ?? []).sort((a, c) => +new Date(c.createdAt) - +new Date(a.createdAt));
                let furthest = 'None';
                for (const p of ps) if ((STAGE_RANK[p.stage] ?? 0) > (STAGE_RANK[furthest] ?? -1)) furthest = p.stage;
                const fl = flags.filter((f) => f.req.id === r.id);
                return (
                  <tr key={r.id} className={fl.length ? 'red' : ''}>
                    <td>{r.city}</td>
                    <td>
                      <details>
                        <summary style={{ cursor: 'pointer' }}>
                          <b>{r.microMarket}</b> <span className="code">{r.code}</span> {r.status !== 'open' && <span className="pill p-no">{r.status.replace('_', ' ')}</span>}
                        </summary>
                        <div style={{ padding: '6px 0' }}>
                          {ps.length === 0 && <div className="muted small">Nothing pitched yet.</div>}
                          {ps.map((p) => {
                            const prop = b.propById.get(p.property.toString());
                            return (
                              <div key={p._id.toString()} className="small row-flex" style={{ gap: 6, padding: '3px 0' }}>
                                <Link className="mono" href={`/admin/properties/${p.property}`}>
                                  {prop?.code}
                                </Link>
                                <span className="muted">{fmtDate(p.createdAt)}</span>
                                <StageBadge stage={p.stage} />
                              </div>
                            );
                          })}
                          <Link className="btn tiny primary" href={`/admin/requirements/${r.id}`} style={{ marginTop: 6 }}>
                            Pitch
                          </Link>
                        </div>
                      </details>
                    </td>
                    <td className="num">{r.storesWanted}</td>
                    <td className="num">{ps.length}</td>
                    <td>{furthest === 'None' ? <span className="muted">None</span> : <StageBadge stage={furthest} />}</td>
                    <td className="num">{Math.floor((Date.now() - +new Date(r.postedAt)) / 86400000)}</td>
                    <td>
                      {fl.map((f) => (
                        <div key={f.kind} className="row-flex" style={{ gap: 6 }}>
                          <span className="kind red">{FLAG_LABEL[f.kind]}</span>
                          {f.kind === 'confirm_active' && <StillActiveButton requirementId={r.id} />}
                        </div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {brand.notes && (
        <div className="panel private" style={{ marginTop: 16 }}>
          <div className="ph">
            <h3>Brand notes</h3>
          </div>
          <div className="pb" style={{ whiteSpace: 'pre-wrap' }}>
            {brand.notes}
          </div>
        </div>
      )}
    </main>
  );
}
