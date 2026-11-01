import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageAdmin } from '@/lib/auth';
import { isId } from '@/lib/http';
import { getSettings, locationLists } from '@/lib/settings';
import { evaluateMatch } from '@/lib/domain';
import { fmtDate, fmtDateTime, inr, inrShort, num, rentRange, sqft } from '@/lib/format';
import { REQUIREMENT_STATUS_LABEL } from '@/lib/constants';
import { FLAG_LABEL, computeFlags, loadBoard, matchPropInput, matchReqInput, matchable, propertyStage, rowFee } from '@/lib/services/board';
import { pitchView } from '@/lib/services/adminView';
import { BrandAsk } from '@/models';
import { DismissButton, PitchButton, PitchStageSelect, StillActiveButton, UndoPitchButton } from '@/components/admin/actions';
import { RequirementEditForm } from '@/components/admin/RequirementEditForm';
import { StageBadge, AdminOnly, RealtorsSee } from '@/components/ui/Badges';

export const metadata: Metadata = { title: 'Requirement' };

function Checks({ checks }: { checks: { key: string; label: string; pass: boolean; soft?: boolean }[] }) {
  return (
    <span className="row-flex" style={{ gap: 8 }}>
      {checks.map((c) => (
        <span key={c.key} className={`check ${c.pass ? 'pass' : 'fail'}`} title={c.soft ? 'Shown as a tag, does not hide the match' : ''}>
          {c.pass ? '✓' : '✕'} {c.label}
        </span>
      ))}
    </span>
  );
}

export default async function AdminRequirement({ params }: { params: Promise<{ id: string }> }) {
  await pageAdmin();
  const { id } = await params;
  if (!isId(id)) notFound();
  const [b, settings] = await Promise.all([loadBoard(), getSettings()]);
  const r = b.reqById.get(id);
  if (!r) notFound();
  const ask = await BrandAsk.findById(r.priv.brandAsk).select('code').lean();
  const flags = computeFlags(b).filter((f) => f.req.id === id);
  const mr = matchReqInput(r);
  const pitches = (b.pitchesByReq.get(id) ?? []).sort((a, c) => +new Date(c.createdAt) - +new Date(a.createdAt)).map((x) => pitchView(b, x));
  const pitchedProps = new Set(pitches.map((p) => p.propertyId));
  const brokerSugg = b.suggestions
    .filter((s) => s.requirement.toString() === id)
    .map((s) => {
      const p = b.propById.get(s.property.toString());
      return p ? { s, p, res: evaluateMatch(mr, matchPropInput(p)) } : null;
    })
    .filter(Boolean) as { s: (typeof b.suggestions)[number]; p: (typeof b.props)[number]; res: ReturnType<typeof evaluateMatch> }[];
  const suggestedProps = new Set(brokerSugg.map((x) => x.p._id.toString()));
  const cityProps = b.props
    .filter((p) => p.city === r.city && !pitchedProps.has(p._id.toString()) && !suggestedProps.has(p._id.toString()))
    .map((p) => ({ p, res: evaluateMatch(mr, matchPropInput(p)), dismissed: b.dismissedKey.has(`${p._id}|${r._id}`) }));
  const system = cityProps.filter((x) => x.res.fits && matchable(x.p) && !x.dismissed);
  const others = cityProps.filter((x) => !(x.res.fits && matchable(x.p) && !x.dismissed)).sort((a, c) => c.res.score - a.res.score);
  const brokerName = (bid: unknown) => b.brokerById.get(String(bid))?.fullName ?? '';

  return (
    <main className="page">
      <p className="muted" style={{ marginTop: 0 }}>
        <Link href="/admin/requirements">← Requirements</Link>
      </p>
      <div className="pagehead">
        <div>
          <div className="row-flex">
            <span className="code big">{r.code}</span>
            {r.priority === 'high' && <span className="prio">Priority</span>}
            <span className={`pill ${r.status === 'open' ? 'l-avail' : 'p-no'}`}>{REQUIREMENT_STATUS_LABEL[r.status]}</span>
            {ask && <span className="code">part of {ask.code}</span>}
          </div>
          <h1>
            <Link href={`/admin/brands/${r.brand._id}`}>{r.brand.name}</Link> · {r.microMarket}, {r.city}
          </h1>
          <p className="lead">
            {r.sector} · posted {fmtDate(r.postedAt)} · {r.storesWanted} store{r.storesWanted === 1 ? '' : 's'} wanted · {inrShort(rowFee(r))} fee per store
          </p>
        </div>
        <RequirementEditForm
          id={r.id}
          locations={locationLists(settings)}
          initial={{
            status: r.status,
            city: r.city,
            microMarket: r.microMarket,
            stretches: r.stretches ?? [],
            storesWanted: r.storesWanted,
            carpetMin: r.carpetMin,
            carpetMax: r.carpetMax,
            rentMin: r.rentMin,
            rentMax: r.rentMax,
            overrides: (r.stretches ?? []).map((s) => {
              const c = r.stretchCarpet?.find((x) => x.stretch === s);
              const rr = r.priv.stretchRent?.find((x) => x.stretch === s);
              return c || rr ? { stretch: s, carpetMin: c?.carpetMin ?? r.carpetMin, carpetMax: c?.carpetMax ?? r.carpetMax, rentMin: rr?.rentMin ?? r.rentMin, rentMax: rr?.rentMax ?? r.rentMax } : null;
            }).filter(Boolean) as { stretch: string; carpetMin: number; carpetMax: number; rentMin: number; rentMax: number }[],
            formats: r.formats ?? [],
            floors: r.floors ?? [],
            minFrontage: r.minFrontage,
            minCeiling: r.minCeiling,
            minPowerKva: r.minPowerKva,
            conditionAccepted: r.conditionAccepted ?? '',
            parkingCars: r.parkingCars,
            parkingBikes: r.parkingBikes,
            signage: r.signage ?? '',
            otherSpecs: r.otherSpecs ?? '',
            maxDepositMonths: r.maxDepositMonths,
            leaseYears: r.leaseYears,
            lockInYears: r.lockInYears,
            priority: r.priority,
            receivedOn: r.priv.receivedOn ? new Date(r.priv.receivedOn).toISOString().slice(0, 10) : '',
            internalNotes: r.priv.internalNotes ?? '',
          }}
        />
      </div>

      {flags.length > 0 && (
        <div className="notice" style={{ marginBottom: 14 }}>
          <div className="row-flex">
            <b>Red flag:</b>
            {flags.map((f) => (
              <span key={f.kind} className="kind red">
                {FLAG_LABEL[f.kind]} · {f.days} days
              </span>
            ))}
            {flags.some((f) => f.kind === 'confirm_active') && <StillActiveButton requirementId={r.id} />}
          </div>
        </div>
      )}

      <div className="two-col">
        <div className="stack" style={{ gap: 16 }}>
          <div className="panel">
            <div className="ph">
              <h3>Broker suggestions ({brokerSugg.length})</h3>
              <span className="muted small">Hints from brokers. Only you see these.</span>
            </div>
            <div className="pb">
              {brokerSugg.length === 0 && <span className="muted">No broker has suggested a property for this yet.</span>}
              {brokerSugg.map(({ s, p, res }) => (
                <div className="rowline" key={s._id.toString()}>
                  <span className="grow">
                    <Link className="mono" href={`/admin/properties/${p._id}`}>
                      {p.code}
                    </Link>{' '}
                    · {p.microMarket} · {num(p.carpetArea)} sq ft · {inr(p.rent)}/sq ft · by {brokerName(s.broker)} on {fmtDate(s.createdAt)}
                    {s.note && <div className="small">“{s.note}”</div>}
                    <div>
                      <Checks checks={res.checks} />
                    </div>
                  </span>
                  {s.status === 'pending' && !pitchedProps.has(p._id.toString()) ? (
                    <span className="row-flex">
                      <PitchButton pairs={[{ propertyId: p._id.toString(), requirementId: r.id }]} />
                      <DismissButton propertyId={p._id.toString()} requirementId={r.id} label="Not suitable" />
                    </span>
                  ) : (
                    <span className={`pill ${s.status === 'pitched' ? 'p-won' : 'p-no'}`}>{s.status === 'pitched' ? 'Pitched' : 'Dismissed'}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <h3>Suggested by the system ({system.length})</h3>
              {system.length > 1 && <PitchButton label={`Pitch all ${system.length}`} pairs={system.map((x) => ({ propertyId: x.p._id.toString(), requirementId: r.id }))} />}
            </div>
            <div className="pb">
              <p className="muted small" style={{ marginTop: 0 }}>
                Same micro market{r.stretches?.length ? ' and stretch' : ''}, a ticked format, carpet within range, a preferred floor, ceiling and power at or above minimum. Rent above budget shows as a tag, not a filter.
              </p>
              {system.length === 0 && <span className="muted">No fitting property in the inventory right now.</span>}
              {system.map(({ p, res }) => (
                <div className="rowline" key={p._id.toString()}>
                  <span className="grow">
                    <Link className="mono" href={`/admin/properties/${p._id}`}>
                      {p.code}
                    </Link>{' '}
                    · {p.stretch || p.microMarket} · {num(p.carpetArea)} sq ft · {inr(p.rent)}/sq ft · {p.format} · {brokerName(p.broker)}
                    {res.tags.map((t) => (
                      <span key={t} className="pill p-match" style={{ marginLeft: 6 }}>
                        {t}
                      </span>
                    ))}
                    <div>
                      <Checks checks={res.checks} />
                    </div>
                  </span>
                  <span className="row-flex">
                    <PitchButton pairs={[{ propertyId: p._id.toString(), requirementId: r.id }]} />
                    <DismissButton propertyId={p._id.toString()} requirementId={r.id} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="ph">
              <h3>Pitched ({pitches.length})</h3>
              <span className="muted small">Each pitch is the record of what was sent to the brand and when.</span>
            </div>
            <div className="pb">
              {pitches.length === 0 && <span className="muted">Nothing pitched yet.</span>}
              {pitches.map((x) => (
                <div className="rowline" key={x.id} style={{ alignItems: 'flex-start' }}>
                  <span className="grow">
                    <Link className="mono" href={`/admin/properties/${x.propertyId}`}>
                      {x.propertyCode}
                    </Link>{' '}
                    · {x.brokerName} · pitched {fmtDate(x.createdAt)} by {x.byName}
                    {x.note && <div className="small">Note: {x.note}</div>}
                    {x.stageNote && x.stage === 'Not closed' && <div className="small">Not closed: {x.stageNote}</div>}
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
                  <span className="row-flex">
                    <PitchStageSelect pitchId={x.id} stage={x.stage} />
                    {x.stage === 'Pitched' && x.history.length <= 1 && <UndoPitchButton pitchId={x.id} />}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {others.length > 0 && (
            <details className="panel">
              <summary className="ph" style={{ cursor: 'pointer' }}>
                <h3>Other properties in {r.city} ({others.length})</h3>
                <span className="muted small">Do not pass every check, were dismissed, or are not available</span>
              </summary>
              <div className="pb">
                {others.slice(0, 60).map(({ p, res, dismissed }) => {
                  const st = propertyStage(b, p);
                  return (
                    <div className="rowline" key={p._id.toString()}>
                      <span className="grow">
                        <Link className="mono" href={`/admin/properties/${p._id}`}>
                          {p.code}
                        </Link>{' '}
                        · {p.microMarket} · {num(p.carpetArea)} sq ft · {inr(p.rent)}/sq ft · <StageBadge stage={st.stage} />
                        {dismissed && <span className="pill p-no" style={{ marginLeft: 6 }}>Dismissed</span>}
                        {p.listingStatus !== 'available' && <span className="pill p-no" style={{ marginLeft: 6 }}>{p.listingStatus.replace('_', ' ')}</span>}
                        <div>
                          <Checks checks={res.checks.filter((c) => !c.pass)} />
                        </div>
                      </span>
                      {matchable(p) && r.status === 'open' && <PitchButton className="small" label="Pitch anyway" pairs={[{ propertyId: p._id.toString(), requirementId: r.id }]} />}
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>

        <div className="stack sticky" style={{ gap: 14 }}>
          <div className="panel private">
            <div className="ph">
              <h3>Brand and deal</h3>
              <AdminOnly />
            </div>
            <div className="pb">
              <dl className="kv">
                <dt>Brand</dt>
                <dd>
                  <Link href={`/admin/brands/${r.brand._id}`}>{r.brand.name}</Link>
                </dd>
                <dt>Contact</dt>
                <dd>{[r.brand.contactName, r.brand.designation].filter(Boolean).join(', ') || '—'}</dd>
                <dt>Phone</dt>
                <dd>{r.brand.phone || '—'}</dd>
                <dt>Store model</dt>
                <dd>{r.brand.storeModel || '—'}</dd>
                <dt>Our fee</dt>
                <dd>{r.paysNothing ? 'Brand pays nothing' : `${r.fee} days rent`}</dd>
                <dt>Exact rent</dt>
                <dd>
                  {inr(r.rentMin)} to {inr(r.rentMax)} per sq ft
                </dd>
                {(r.priv.stretchRent ?? []).map((s) => (
                  <span key={s.stretch} style={{ display: 'contents' }}>
                    <dt>Rent on {s.stretch}</dt>
                    <dd>
                      {inr(s.rentMin)} to {inr(s.rentMax)}
                    </dd>
                  </span>
                ))}
                <dt>Stores wanted</dt>
                <dd>{r.storesWanted}</dd>
                <dt>Received on</dt>
                <dd>{fmtDate(r.priv.receivedOn)}</dd>
                <dt>Notes</dt>
                <dd style={{ whiteSpace: 'pre-wrap' }}>{r.priv.internalNotes || '—'}</dd>
              </dl>
            </div>
          </div>
          <div className="panel">
            <div className="ph">
              <h3>What realtors see</h3>
              <RealtorsSee />
            </div>
            <div className="pb">
              <dl className="kv">
                <dt>Location</dt>
                <dd>
                  {r.microMarket}, {r.city}
                </dd>
                <dt>Stretches</dt>
                <dd>{r.stretches?.length ? r.stretches.join(', ') : 'Anywhere'}</dd>
                <dt>Sector</dt>
                <dd>{r.sector}</dd>
                <dt>Format</dt>
                <dd>{r.formats.join(', ')}</dd>
                <dt>Carpet</dt>
                <dd>{sqft(r.carpetMin, r.carpetMax)}</dd>
                <dt>Rent band</dt>
                <dd>{rentRange(r.rentBandMin, r.rentBandMax)}</dd>
                <dt>Floors</dt>
                <dd>{r.floors.join(', ')}</dd>
                <dt>Frontage</dt>
                <dd>{r.minFrontage ? `${r.minFrontage} ft+` : '—'}</dd>
                <dt>Ceiling</dt>
                <dd>{r.minCeiling ? `${r.minCeiling} ft+` : '—'}</dd>
                <dt>Power</dt>
                <dd>{r.minPowerKva ? `${r.minPowerKva} kVA+` : '—'}</dd>
                {r.paysNothingNotice && (
                  <>
                    <dt>Notice</dt>
                    <dd>Brand pays no commission</dd>
                  </>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
