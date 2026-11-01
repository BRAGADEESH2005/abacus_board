import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageAdmin } from '@/lib/auth';
import { isId } from '@/lib/http';
import { displayPhone, fmtDate, fmtDateTime, inr, num } from '@/lib/format';
import { loadBoard, matchable, propertyStage, rankRequirementsForProperty } from '@/lib/services/board';
import { pitchView, propView } from '@/lib/services/adminView';
import { hasFloorPlan } from '@/lib/services/levels';
import { DuplicateButtons, PitchStageSelect, PropertyStageSelect, UndoPitchButton } from '@/components/admin/actions';
import { PitchToRequirement } from '@/components/admin/PitchToRequirement';
import { PinMap } from '@/components/admin/PinMap';
import { PlanSvg } from '@/components/broker/FloorPlanHelper';
import { Avatar } from '@/components/ui/Avatar';
import { ListingBadge } from '@/components/ui/Badges';
import type { Pt } from '@/lib/floorplan';

export const metadata: Metadata = { title: 'Property' };

const yn = (v: boolean | null | undefined) => (v === true ? 'Yes' : v === false ? 'No' : '—');
const val = (v: unknown, suffix = '') => (v === null || v === undefined || v === '' ? '—' : `${v}${suffix}`);

export default async function AdminProperty({ params }: { params: Promise<{ id: string }> }) {
  await pageAdmin();
  const { id } = await params;
  if (!isId(id)) notFound();
  const b = await loadBoard();
  const p = b.propById.get(id);
  if (!p) notFound();
  const v = propView(b, p);
  const st = propertyStage(b, p);
  const broker = b.brokerById.get(p.broker.toString());
  const pitches = (b.pitchesByProp.get(id) ?? []).sort((a, c) => +new Date(c.createdAt) - +new Date(a.createdAt)).map((x) => pitchView(b, x));
  const ranked = rankRequirementsForProperty(b, p).map((x) => ({
    id: x.req.id,
    code: x.req.code,
    brand: x.req.brand.name,
    place: `${x.req.microMarket}, ${x.req.city}`,
    fits: x.result.fits,
    tags: x.result.tags,
    failed: x.result.checks.filter((c) => !c.pass && !c.soft).map((c) => c.label),
    pitched: x.pitched,
  }));
  const suggestions = b.suggestions.filter((s) => s.property.toString() === id);
  const dups = b.dups.filter((d) => d.a.toString() === id || d.b.toString() === id);
  const fp = p.floorPlan as { sameLayout?: boolean; plans?: { floor: string; points: Pt[]; doorSide: number; option: string; area: number | null; adjusted: number[] }[] } | null;
  const merged = p.state === 'merged' ? b.propById.get(String(p.mergedInto)) : null;

  return (
    <main className="page">
      <p className="muted" style={{ marginTop: 0 }}>
        <Link href="/admin/properties">← Inventory</Link>
      </p>
      <div className="pagehead">
        <div>
          <div className="row-flex">
            <span className="code big">{p.code}</span>
            <ListingBadge status={p.listingStatus} />
            {v.duplicate && <span className="kind red">Possible duplicate</span>}
          </div>
          <h1>{[p.buildingName, p.microMarket, p.city].filter(Boolean).join(', ')}</h1>
          <p className="lead">
            {p.format} · {num(p.carpetArea)} sq ft carpet · {inr(p.rent)}/sq ft · uploaded {fmtDateTime(p.submittedAt)}
          </p>
        </div>
        <div className="row-flex">
          <PropertyStageSelect propertyId={id} stage={st.stage} pitches={v.pitches} />
          <PitchToRequirement propertyId={id} code={p.code} options={ranked} disabledReason={!matchable(p) ? (p.state === 'merged' ? 'Merged duplicate' : 'Listing is not available') : undefined} />
        </div>
      </div>
      {merged && (
        <div className="notice" style={{ marginBottom: 12 }}>
          Merged into <Link href={`/admin/properties/${merged._id}`}>{merged.code}</Link> (earlier upload of the same space).
        </div>
      )}
      {p.listingStatus === 'needs_reconfirm' && <div className="notice amber" style={{ marginBottom: 12 }}>Not confirmed by the broker for 30 days. It is out of matching until the broker taps Still available.</div>}
      {st.stage === 'Not closed' && st.note && <div className="notice" style={{ marginBottom: 12 }}>Not closed: {st.note}</div>}

      <div className="two-col">
        <div className="stack" style={{ gap: 14 }}>
          <div className="detail">
            <div className="blocks">
              <div className="block">
                <h4>A. Basics</h4>
                <dl>
                  <dt>City</dt>
                  <dd>{p.city}</dd>
                  <dt>Micro market</dt>
                  <dd>{p.microMarket}</dd>
                  <dt>Stretch</dt>
                  <dd>{val(p.stretch)}</dd>
                  <dt>Format</dt>
                  <dd>{p.format}</dd>
                  <dt>Address</dt>
                  <dd>{p.address}</dd>
                  <dt>Building</dt>
                  <dd>{val(p.buildingName)}</dd>
                  <dt>Main road</dt>
                  <dd>{val(p.mainRoad)}</dd>
                </dl>
              </div>
              <div className="block">
                <h4>C. Area and floors</h4>
                <dl>
                  <dt>Chargeable</dt>
                  <dd>{num(p.chargeableArea)} sq ft</dd>
                  <dt>Carpet</dt>
                  <dd>{num(p.carpetArea)} sq ft</dd>
                  <dt>Floors</dt>
                  <dd>{p.floorCount}</dd>
                  <dt>Per floor</dt>
                  <dd>{(p.floorAreas ?? []).map((a) => num(a)).join(' + ') || '—'}</dd>
                  <dt>Same layout</dt>
                  <dd>{yn(p.sameLayout)}</dd>
                  <dt>Ceiling</dt>
                  <dd>{val(p.ceilingHeight, ' ft')}</dd>
                  <dt>Frontage</dt>
                  <dd>{val(p.frontage, ' ft')}</dd>
                </dl>
              </div>
              <div className="block">
                <h4>D. Commercials</h4>
                <dl>
                  <dt>Quoted rent</dt>
                  <dd>{inr(p.rent)} per sq ft</dd>
                  <dt>Deposit</dt>
                  <dd>{val(p.depositMonths, ' months')}</dd>
                  <dt>Maintenance</dt>
                  <dd>{p.maintenance ? inr(p.maintenance) : '—'}</dd>
                  <dt>Escalation</dt>
                  <dd>{val(p.escalation)}</dd>
                </dl>
              </div>
              <div className="block">
                <h4>Landlord</h4>
                <dl>
                  <dt>Landlord</dt>
                  <dd>{p.landlordName}</dd>
                  <dt>Dealt with</dt>
                  <dd>{p.dealtWith}</dd>
                  <dt>Go ahead</dt>
                  <dd>
                    {p.goAheadFileId ? (
                      <a href={`/api/files/${p.goAheadFileId}`} target="_blank" rel="noreferrer">
                        {p.goAheadFileName || 'Open document'}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--maroon)' }}>Not uploaded</span>
                    )}
                  </dd>
                </dl>
              </div>
              <div className="block">
                <h4>E. Building and services</h4>
                <dl>
                  <dt>Power</dt>
                  <dd>
                    {val(p.powerKva, ' kVA')} · backup {yn(p.powerBackup)}
                  </dd>
                  <dt>Lift</dt>
                  <dd>{p.lift === null ? 'Not applicable' : yn(p.lift)}</dd>
                  <dt>Bike parking</dt>
                  <dd>
                    {val(p.bikeSlots)} {p.bikeType}
                  </dd>
                  <dt>Car parking</dt>
                  <dd>
                    {val(p.carSlots)} {p.carType}
                  </dd>
                  <dt>Toilets</dt>
                  <dd>{val(p.toilets)}</dd>
                  <dt>Signage space</dt>
                  <dd>{yn(p.signageSpace)}</dd>
                </dl>
              </div>
              <div className="block">
                <h4>F and G. Premises and status</h4>
                <dl>
                  <dt>Tank below</dt>
                  <dd>{p.septicBelow === null ? 'Not applicable' : yn(p.septicBelow)}</dd>
                  <dt>Windows</dt>
                  <dd>{yn(p.windows)}</dd>
                  <dt>Electrical boards</dt>
                  <dd>{yn(p.electricalBoards)}</dd>
                  <dt>Status</dt>
                  <dd>{p.condition}</dd>
                  <dt>Available</dt>
                  <dd>{p.availableDate ? fmtDate(p.availableDate) : 'Now'}</dd>
                </dl>
              </div>
            </div>
            <div className="acts" style={{ background: 'var(--surface)' }}>
              {p.driveLink ? (
                <a className="btn small" href={p.driveLink} target="_blank" rel="noreferrer">
                  Photos and videos (Drive) ↗
                </a>
              ) : (
                <span className="chip warn">No Drive link</span>
              )}
              {p.pinLink && (
                <a className="btn small" href={p.pinLink} target="_blank" rel="noreferrer">
                  Broker&apos;s map link ↗
                </a>
              )}
            </div>
            {p.notes && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
                <h4 style={{ margin: '0 0 6px', font: '600 11px var(--body)', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ink-3)' }}>H2. Broker notes</h4>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14 }}>{p.notes}</p>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="ph">
              <h3>Pitches ({pitches.length})</h3>
              <span className="muted small">Each pitch has its own stage. The broker sees only the furthest stage name.</span>
            </div>
            <div className="pb">
              {pitches.length === 0 && <span className="muted">Not pitched yet.</span>}
              {pitches.map((x) => (
                <div className="rowline" key={x.id} style={{ alignItems: 'flex-start' }}>
                  <span className="grow">
                    <b>{x.brandName}</b>{' '}
                    <Link className="mono" href={`/admin/requirements/${x.requirementId}`}>
                      {x.requirementCode}
                    </Link>{' '}
                    · {x.place} · pitched {fmtDate(x.createdAt)} by {x.byName}
                    <details>
                      <summary className="small muted" style={{ cursor: 'pointer' }}>
                        History ({x.history.length})
                      </summary>
                      {x.history.map((h, i) => (
                        <div key={i} className="small">
                          {fmtDateTime(h.at)} · <b>{h.stage}</b> by {h.byName}
                          {h.note ? ` · ${h.note}` : ''}
                        </div>
                      ))}
                    </details>
                  </span>
                  <PitchStageSelect pitchId={x.id} stage={x.stage} />
                  {x.stage === 'Pitched' && x.history.length <= 1 && <UndoPitchButton pitchId={x.id} />}
                </div>
              ))}
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="panel">
              <div className="ph">
                <h3>Broker suggested this for</h3>
              </div>
              <div className="pb">
                {suggestions.map((s) => {
                  const r = b.reqById.get(s.requirement.toString());
                  return (
                    <div className="rowline" key={s._id.toString()}>
                      <Link className="mono" href={`/admin/requirements/${s.requirement}`}>
                        {r?.code}
                      </Link>
                      <span>{r?.brand.name}</span>
                      <span className="muted">{fmtDate(s.createdAt)}</span>
                      {s.note && <span className="small">“{s.note}”</span>}
                      <span className={`pill right ${s.status === 'pitched' ? 'p-won' : s.status === 'dismissed' ? 'p-no' : 'p-wait'}`}>{s.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {fp?.plans?.length ? (
            <div className="panel">
              <div className="ph">
                <h3>Floor plan</h3>
                <span className="muted small">{hasFloorPlan(p) ? 'Drawn by the broker from tape measurements' : 'Broker was not sure of the shape'}</span>
              </div>
              <div className="pb fp-options">
                {fp.plans.map((pl, i) => (
                  <div key={i} className="fp-opt" style={{ cursor: 'default' }}>
                    <PlanSvg points={pl.points ?? []} doorSide={pl.doorSide} highlight={pl.adjusted ?? []} w={300} h={220} />
                    <b>{fp.sameLayout ? 'Every floor' : `${pl.floor} floor`}</b>
                    <div className="muted">
                      {pl.option === 'closed' ? 'Nearest closed shape' : pl.option === 'mirror' ? 'Mirror image' : pl.option === 'unsure' ? 'Not sure' : 'As drawn'}
                      {pl.area ? ` · ${num(pl.area)} sq ft` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="panel">
            <div className="ph">
              <h3>Stage history</h3>
            </div>
            <div className="pb">
              {(p.stageHistory ?? [])
                .slice()
                .reverse()
                .map((h, i) => (
                  <div key={i} className="small rowline">
                    {fmtDateTime(h.at)} · <b>{h.stage}</b> · {h.byName}
                    {h.note ? ` · ${h.note}` : ''}
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="stack sticky" style={{ gap: 14 }}>
          {broker && (
            <div className="panel">
              <div className="ph">
                <h3>Broker</h3>
              </div>
              <div className="pb row-flex" style={{ alignItems: 'flex-start' }}>
                <Avatar name={broker.fullName} fileId={broker.avatarFileId ? String(broker.avatarFileId) : null} size={44} />
                <div className="grow small">
                  <Link href={`/admin/brokers/${broker._id}`}>
                    <b>{broker.fullName}</b>
                  </Link>{' '}
                  @{broker.username}
                  <div>{broker.company}</div>
                  <div>
                    <a href={`tel:${broker.phone}`}>{displayPhone(broker.phone)}</a> · <a href={`mailto:${broker.email}`}>{broker.email}</a>
                  </div>
                </div>
              </div>
            </div>
          )}
          {p.lat != null && p.lng != null && (
            <div className="panel">
              <div className="ph">
                <h3>Pin</h3>
                <span className="muted small mono">
                  {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                </span>
              </div>
              <div className="pb">
                <PinMap lat={p.lat} lng={p.lng} />
                <a className="small" href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer">
                  Open in Google Maps ↗
                </a>
              </div>
            </div>
          )}
          {dups.length > 0 && (
            <div className="panel private">
              <div className="ph">
                <h3>Possible duplicates</h3>
              </div>
              <div className="pb">
                {dups.map((d) => {
                  const otherId = d.a.toString() === id ? d.b.toString() : d.a.toString();
                  const o = b.propById.get(otherId);
                  const earlier = d.a.toString() === id;
                  return (
                    <div key={d._id.toString()} className="stack" style={{ gap: 6, marginBottom: 10 }}>
                      <div className="small">
                        <Link className="mono" href={`/admin/properties/${otherId}`}>
                          {o?.code}
                        </Link>{' '}
                        by {b.brokerById.get(String(o?.broker))?.fullName}, pin {d.distanceM} m away. This one was uploaded {earlier ? 'first' : 'later'} ({fmtDateTime(p.submittedAt)} vs {fmtDateTime(o?.submittedAt)}).
                      </div>
                      {d.status === 'pending' ? <DuplicateButtons pairId={d._id.toString()} /> : <span className="muted small">Resolved: {d.status === 'merged' ? 'merged' : 'kept both'} by {d.resolvedByName}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
