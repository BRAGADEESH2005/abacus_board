'use client';
import { useMemo, useState } from 'react';
import { mirror, nearestClosed, polygonArea, sideLengths, snap, toScreen, walk, type Pt, type Side, type Turn } from '@/lib/floorplan';
import { num } from '@/lib/format';

export type Plan = {
  floor: string;
  mode: 'sides' | 'draw';
  sides: Side[];
  doorSide: number;
  option: 'drawn' | 'mirror' | 'closed' | 'unsure' | null;
  points: Pt[];
  area: number | null;
  gap: number | null;
  adjusted: number[];
};
export type FloorPlanValue = { sameLayout: boolean; plans: Plan[] } | null;

const blankSides = (n: number): Side[] => Array.from({ length: n }, () => ({ length: 0, turn: 'R' as Turn, diagonal: null }));

export function emptyPlan(floor: string): Plan {
  return { floor, mode: 'sides', sides: blankSides(4), doorSide: 1, option: null, points: [], area: null, gap: null, adjusted: [] };
}

/** Draws a plan to scale with side labels and the door marked. */
export function PlanSvg({ points, doorSide = 1, highlight = [], w = 260, h = 190, labels = true }: { points: Pt[]; doorSide?: number; highlight?: number[]; w?: number; h?: number; labels?: boolean }) {
  if (points.length < 3) return <svg className="fp-svg" viewBox={`0 0 ${w} ${h}`} />;
  const { pts } = toScreen(points, w, h);
  const lens = sideLengths(points);
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const grid = [];
  for (let x = 0; x <= w; x += 20) grid.push(<line key={`x${x}`} x1={x} y1={0} x2={x} y2={h} stroke="#f1ecea" />);
  for (let y = 0; y <= h; y += 20) grid.push(<line key={`y${y}`} x1={0} y1={y} x2={w} y2={y} stroke="#f1ecea" />);
  return (
    <svg className="fp-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Floor plan drawing">
      {grid}
      <polygon points={pts.map((p) => p.join(',')).join(' ')} fill="#F6E7E6" stroke="#7F1416" strokeWidth="1.5" />
      {pts.map((p, i) => {
        const q = pts[(i + 1) % pts.length]!;
        const mx = (p[0] + q[0]) / 2;
        const my = (p[1] + q[1]) / 2;
        const dx = mx - cx;
        const dy = my - cy;
        const d = Math.hypot(dx, dy) || 1;
        const lx = mx + (dx / d) * 12;
        const ly = my + (dy / d) * 12;
        const isDoor = i + 1 === doorSide;
        const hi = highlight.includes(i);
        return (
          <g key={i}>
            {hi && <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#9A6408" strokeWidth="4" />}
            {isDoor && (
              <line
                x1={p[0] + (q[0] - p[0]) * 0.3}
                y1={p[1] + (q[1] - p[1]) * 0.3}
                x2={p[0] + (q[0] - p[0]) * 0.7}
                y2={p[1] + (q[1] - p[1]) * 0.7}
                stroke="#1F5A7A"
                strokeWidth="5"
                strokeLinecap="round"
              />
            )}
            {labels && (
              <text x={lx} y={ly} fontSize="10" textAnchor="middle" dominantBaseline="middle" fill={hi ? '#9A6408' : '#5E5F5A'} fontFamily="IBM Plex Sans, sans-serif">
                {i + 1} · {lens[i]} ft
              </text>
            )}
          </g>
        );
      })}
      <circle cx={pts[0]![0]} cy={pts[0]![1]} r="3.5" fill="#1F5A7A" />
    </svg>
  );
}

function DrawGrid({ points, onChange, size }: { points: Pt[]; onChange: (p: Pt[]) => void; size: number }) {
  const W = 520;
  const cell = W / size;
  const H = Math.round(cell * Math.round(size * 0.7));
  const rows = Math.round(size * 0.7);
  const click = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * size;
    const y = ((e.clientY - r.top) / r.height) * rows;
    const p = snap([x, y]);
    const last = points[points.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) return;
    onChange([...points, p]);
  };
  const lens = points.length > 1 ? sideLengths(points) : [];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fp-svg" style={{ cursor: 'crosshair', border: '1px solid var(--line)' }} onClick={click} role="img" aria-label="Drawing grid, 1 square is 1 foot">
      {Array.from({ length: size + 1 }, (_, i) => (
        <line key={`v${i}`} x1={i * cell} y1={0} x2={i * cell} y2={H} stroke={i % 5 === 0 ? '#e4dcd9' : '#f4f0ee'} />
      ))}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * cell} x2={W} y2={i * cell} stroke={i % 5 === 0 ? '#e4dcd9' : '#f4f0ee'} />
      ))}
      {points.length > 2 && <polygon points={points.map((p) => `${p[0] * cell},${p[1] * cell}`).join(' ')} fill="#F6E7E6" stroke="#7F1416" strokeWidth="1.5" />}
      {points.length === 2 && <line x1={points[0]![0] * cell} y1={points[0]![1] * cell} x2={points[1]![0] * cell} y2={points[1]![1] * cell} stroke="#7F1416" strokeWidth="1.5" />}
      {points.map((p, i) => (
        <circle key={i} cx={p[0] * cell} cy={p[1] * cell} r={4} fill={i === 0 ? '#1F5A7A' : '#7F1416'} />
      ))}
      {points.length > 2 &&
        points.map((p, i) => {
          const q = points[(i + 1) % points.length]!;
          return (
            <text key={`t${i}`} x={((p[0] + q[0]) / 2) * cell} y={((p[1] + q[1]) / 2) * cell - 4} fontSize="10" textAnchor="middle" fill="#5E5F5A">
              {lens[i]} ft
            </text>
          );
        })}
    </svg>
  );
}

function PlanEditor({ plan, onChange, carpet, frontage, floorLabel }: { plan: Plan; onChange: (p: Plan) => void; carpet: number | null; frontage: number | null; floorLabel: string }) {
  const filled = plan.sides.every((s) => s.length > 0 && (s.turn !== 'A' || (s.diagonal ?? 0) > 0));
  const w = useMemo(() => (filled ? walk(plan.sides) : null), [plan.sides, filled]);
  const fix = useMemo(() => (w && w.gap > 1 ? nearestClosed(plan.sides) : null), [w, plan.sides]);
  const drawnArea = w ? polygonArea(w.points) : 0;

  const options = useMemo(() => {
    if (!w) return [];
    const list: { key: Plan['option']; title: string; points: Pt[]; highlight: number[]; note: string }[] = [
      { key: 'drawn', title: 'As drawn', points: w.points, highlight: [], note: w.gap > 1 ? `Ends ${num(w.gap)} ft from the start` : 'Closes' },
      { key: 'mirror', title: 'Mirror image', points: mirror(w.points), highlight: [], note: 'If you walked anticlockwise' },
    ];
    if (fix && fix.changed.length) {
      const fw = walk(fix.sides);
      list.push({
        key: 'closed',
        title: 'Nearest closed shape',
        points: fw.points,
        highlight: fix.changed,
        note: fix.changed.map((i) => `Side ${i + 1}: ${plan.sides[i]!.length} → ${fix.sides[i]!.length} ft`).join(', '),
      });
    }
    return list;
  }, [w, fix, plan.sides]);

  const setSide = (i: number, patch: Partial<Side>) => {
    const sides = plan.sides.map((s, k) => (k === i ? { ...s, ...patch } : s));
    onChange({ ...plan, sides, option: null, points: [], area: null });
  };
  const setCount = (n: number) => {
    const sides = Array.from({ length: n }, (_, i) => plan.sides[i] ?? { length: 0, turn: 'R' as Turn, diagonal: null });
    onChange({ ...plan, sides, option: null, points: [], area: null, doorSide: Math.min(plan.doorSide, n) });
  };
  const pick = (key: Plan['option']) => {
    const o = options.find((x) => x.key === key);
    if (key === 'unsure') {
      onChange({ ...plan, option: 'unsure', points: w?.points ?? [], area: w ? Math.round(drawnArea) : null, gap: w?.gap ?? null, adjusted: [] });
      return;
    }
    if (!o) return;
    onChange({ ...plan, option: key, points: o.points, area: Math.round(polygonArea(o.points)), gap: key === 'closed' ? 0 : w?.gap ?? null, adjusted: o.highlight });
  };

  const areaWarn = (a: number) => carpet && a > 0 && Math.abs(a - carpet) / carpet > 0.1;
  const frontWarn = frontage && plan.sides[plan.doorSide - 1]?.length && Math.abs(plan.sides[plan.doorSide - 1]!.length - frontage) > 1;

  if (plan.mode === 'draw') {
    const area = plan.points.length >= 3 ? Math.round(polygonArea(plan.points)) : 0;
    const size = Math.min(120, Math.max(30, Math.ceil(Math.sqrt(carpet || 1500) * 1.6)));
    return (
      <div className="stack">
        <div className="spread">
          <span className="small">
            <b>{floorLabel}</b>: tap the corners in order. 1 square = 1 ft. The shape closes back to the first corner.
          </span>
          <span className="row-flex">
            <button type="button" className="btn tiny" onClick={() => onChange({ ...plan, points: plan.points.slice(0, -1), option: plan.points.length > 3 ? 'drawn' : null, area: null })} disabled={!plan.points.length}>
              Undo
            </button>
            <button type="button" className="btn tiny" onClick={() => onChange({ ...plan, points: [], option: null, area: null })}>
              Clear
            </button>
            <button type="button" className="btn tiny" onClick={() => onChange({ ...emptyPlan(plan.floor) })}>
              Back to side lengths
            </button>
          </span>
        </div>
        <DrawGrid points={plan.points} size={size} onChange={(pts) => onChange({ ...plan, points: pts, option: pts.length >= 3 ? 'drawn' : null, area: pts.length >= 3 ? Math.round(polygonArea(pts)) : null, gap: 0 })} />
        {area > 0 && (
          <span className={areaWarn(area) ? 'warnmsg' : 'hint'}>
            Area worked out: {num(area)} sq ft{carpet ? ` (carpet area ${num(carpet)} sq ft${areaWarn(area) ? ', more than 10% off. Check the corners. You can still save.' : ')'}` : ''}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row-flex">
        <label className="f" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          Number of sides
          <select className="input" style={{ width: 80 }} value={plan.sides.length} onChange={(e) => setCount(Number(e.target.value))}>
            {[4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="f" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          Door on side
          <select className="input" style={{ width: 70 }} value={plan.doorSide} onChange={(e) => onChange({ ...plan, doorSide: Number(e.target.value) })}>
            {plan.sides.map((_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn tiny right" onClick={() => onChange({ ...plan, mode: 'draw', points: [], option: null, area: null })}>
          Draw it myself
        </button>
      </div>
      <div className="fp-sides">
        <span className="hd">Side</span>
        <span className="hd">Length (ft)</span>
        <span className="hd">Turn after it</span>
        <span className="hd diag">Diagonal (angled only)</span>
        {plan.sides.map((s, i) => (
          <div key={i} style={{ display: 'contents' }} className={fix?.changed.includes(i) ? 'bad' : ''}>
            <span className="mono">{i + 1}{i + 1 === plan.doorSide ? ' 🚪' : ''}</span>
            <input type="number" min={0} step="0.5" inputMode="decimal" value={s.length || ''} onChange={(e) => setSide(i, { length: Number(e.target.value) || 0 })} aria-label={`Side ${i + 1} length`} />
            <select value={s.turn} onChange={(e) => setSide(i, { turn: e.target.value as Turn })} aria-label={`Turn after side ${i + 1}`} disabled={i === plan.sides.length - 1}>
              <option value="R">Right</option>
              <option value="L">Left</option>
              <option value="A">Angled</option>
            </select>
            <span className="diag">
              {s.turn === 'A' && i < plan.sides.length - 1 ? (
                <input type="number" min={0} step="0.5" value={s.diagonal ?? ''} onChange={(e) => setSide(i, { diagonal: Number(e.target.value) || null })} placeholder={`Corner ${i + 1} to ${i + 3 > plan.sides.length ? 1 : i + 3}`} aria-label={`Diagonal after side ${i + 1}`} />
              ) : (
                <span className="muted">—</span>
              )}
            </span>
          </div>
        ))}
      </div>
      {frontWarn && <span className="warnmsg">Side {plan.doorSide} is {plan.sides[plan.doorSide - 1]!.length} ft but the frontage you entered is {frontage} ft.</span>}
      {w?.error && <span className="err">{w.error}</span>}
      {w && w.gap > 1 && (
        <span className="err">
          Sides don&apos;t meet: the last side ends {num(w.gap)} ft from the start.{' '}
          {fix?.changed.length ? `Recheck side ${fix.changed.map((i) => i + 1).join(' and ')}.` : 'Recheck the lengths and turns.'}
        </span>
      )}
      {w && (
        <>
          <span className="small">Pick the shape that matches the space:</span>
          <div className="fp-options">
            {options.map((o) => {
              const a = Math.round(polygonArea(o.points));
              return (
                <button type="button" key={o.key} className={`fp-opt ${plan.option === o.key ? 'on' : ''}`} onClick={() => pick(o.key)}>
                  <PlanSvg points={o.points} doorSide={plan.doorSide} highlight={o.highlight} />
                  <b>{o.title}</b>
                  <div className="muted">{o.note}</div>
                  <div className={areaWarn(a) ? 'warnmsg' : 'hint'}>
                    {num(a)} sq ft{areaWarn(a) ? ' · more than 10% off carpet area' : ''}
                  </div>
                </button>
              );
            })}
            <button type="button" className={`fp-opt ${plan.option === 'unsure' ? 'on' : ''}`} onClick={() => pick('unsure')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
              <b>Not sure</b>
            </button>
          </div>
          {carpet && drawnArea > 0 && areaWarn(drawnArea) && <span className="warnmsg">The drawn area differs from the carpet area ({num(carpet)} sq ft) by more than 10%. You can still save.</span>}
        </>
      )}
    </div>
  );
}

/** C7 Dimensions and shape. One plan copied to every floor, or one per floor when layouts differ (C5). */
export function FloorPlanHelper({ value, floors, floorAreas, sameLayout, carpet, frontage, videoUrl, onChange }: { value: FloorPlanValue; floors: string[]; floorAreas: number[]; sameLayout: boolean; carpet: number | null; frontage: number | null; videoUrl?: string; onChange: (v: FloorPlanValue) => void }) {
  // Compare each drawing with the carpet area of the floor it describes (C4), or the total (C2) for a single floor.
  const carpetFor = (i: number): number | null => {
    if (floors.length <= 1) return carpet;
    if (sameLayout) return floorAreas[0] || (carpet ? carpet / floors.length : null);
    return floorAreas[i] || null;
  };
  const names = sameLayout ? ['All floors'] : floors.length ? floors : ['Ground'];
  const plans = names.map((n, i) => value?.plans?.[i] ?? emptyPlan(n));
  const [open, setOpen] = useState(Boolean(value?.plans?.some((p) => p.points?.length)));

  const update = (i: number, p: Plan) => {
    const next = names.map((n, k) => (k === i ? { ...p, floor: n } : { ...(plans[k] ?? emptyPlan(n)), floor: n }));
    onChange({ sameLayout, plans: next });
  };

  return (
    <div className="stack">
      <div className="spread">
        <span className="hint">
          Optional. Stand at the main door facing in: side 1 is the front wall. Walk the walls clockwise, noting each length and whether the next corner turns right or left.
        </span>
        {videoUrl && (
          <a className="small" href={videoUrl} target="_blank" rel="noreferrer">
            ▶ How to measure
          </a>
        )}
      </div>
      {!open ? (
        <span>
          <button type="button" className="btn small" onClick={() => setOpen(true)}>
            Draw the floor plan
          </button>
        </span>
      ) : (
        plans.map((p, i) => (
          <div key={names[i]} className="panel" style={{ padding: 12 }}>
            {names.length > 1 && <h3 style={{ marginBottom: 8 }}>{names[i]} floor</h3>}
            <PlanEditor plan={p} onChange={(np) => update(i, np)} carpet={carpetFor(i)} frontage={frontage} floorLabel={names[i]!} />
          </div>
        ))
      )}
    </div>
  );
}
