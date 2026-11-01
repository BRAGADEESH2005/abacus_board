// Floor plan helper geometry (Broker Side Changes v2, section 7). Plain geometry, no AI.

export type Turn = 'R' | 'L' | 'A';
export type Side = { length: number; turn: Turn; diagonal?: number | null };
export type Pt = [number, number];

export type Walk = {
  points: Pt[]; // corner points, first is (0,0); closed shapes repeat nothing
  gap: number; // distance between where the last side ends and the start
  end: Pt;
  error?: string;
};

const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Walks the walls clockwise from (0,0) along +x.
 * Right turns rotate the heading by -90°, Left by +90°.
 * An Angled corner turns right by (180° - interior angle); the interior angle comes from the
 * triangle formed by this side, the next side and the measured diagonal (law of cosines).
 */
export function walk(sides: Side[]): Walk {
  let x = 0;
  let y = 0;
  let heading = 0;
  const points: Pt[] = [[0, 0]];
  let error: string | undefined;
  sides.forEach((s, i) => {
    x += s.length * Math.cos(rad(heading));
    y += s.length * Math.sin(rad(heading));
    points.push([x, y]);
    if (i === sides.length - 1) return;
    if (s.turn === 'R') heading -= 90;
    else if (s.turn === 'L') heading += 90;
    else {
      const a = s.length;
      const b = sides[i + 1]?.length ?? 0;
      const d = s.diagonal ?? 0;
      const cos = (a * a + b * b - d * d) / (2 * a * b);
      if (!d || !a || !b || cos < -1 || cos > 1) {
        error = `Side ${i + 1}: the diagonal does not fit those two side lengths.`;
        heading -= 90;
      } else {
        const interior = (Math.acos(cos) * 180) / Math.PI;
        heading -= 180 - interior;
      }
    }
  });
  const end = points[points.length - 1]!;
  points.pop(); // the final point should coincide with the start
  return { points, gap: Math.hypot(end[0], end[1]), end, error };
}

/** Shoelace formula, absolute area in sq ft. */
export function polygonArea(points: Pt[]): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[(i + 1) % points.length]!;
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

export function mirror(points: Pt[]): Pt[] {
  return points.map(([x, y]) => [x, -y]);
}

function directions(sides: Side[]): Pt[] {
  const pts = walk(sides);
  const all = [...pts.points, pts.end];
  const dirs: Pt[] = [];
  for (let i = 0; i < sides.length; i++) {
    const [x1, y1] = all[i]!;
    const [x2, y2] = all[i + 1]!;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    dirs.push([(x2 - x1) / len, (y2 - y1) / len]);
  }
  return dirs;
}

export type Fix = { sides: Side[]; changed: number[]; residual: number };

/**
 * Nearest closed shape: change one side (or two if one cannot close it) by the least amount
 * so the walk ends where it started. Returns null when no positive lengths can close it.
 */
export function nearestClosed(sides: Side[]): Fix | null {
  const w = walk(sides);
  if (w.gap <= 1) return { sides, changed: [], residual: w.gap };
  const g = w.end; // need total displacement of -g
  const dirs = directions(sides);
  let best: Fix | null = null;
  // single side
  dirs.forEach((u, i) => {
    const delta = -(g[0] * u[0] + g[1] * u[1]);
    const nl = sides[i]!.length + delta;
    if (nl <= 0.5) return;
    const rx = g[0] + delta * u[0];
    const ry = g[1] + delta * u[1];
    const residual = Math.hypot(rx, ry);
    if (!best || residual < best.residual - 1e-6 || (Math.abs(residual - best.residual) < 1e-6 && Math.abs(delta) < Math.abs(best.sides[best.changed[0]!]!.length - sides[best.changed[0]!]!.length))) {
      const ns = sides.map((s, k) => (k === i ? { ...s, length: round1(nl) } : s));
      best = { sides: ns, changed: [i], residual };
    }
  });
  if (best && (best as Fix).residual <= 1) return best;
  // pairs of non parallel sides
  let bestPair: Fix | null = null;
  let bestCost = Infinity;
  for (let i = 0; i < dirs.length; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      const [a, c] = dirs[i]!;
      const [b, d] = dirs[j]!;
      const det = a * d - b * c;
      if (Math.abs(det) < 1e-6) continue;
      // di*ui + dj*uj = -g
      const di = (-g[0] * d + g[1] * b) / det;
      const dj = (-g[1] * a + g[0] * c) / det;
      const li = sides[i]!.length + di;
      const lj = sides[j]!.length + dj;
      if (li <= 0.5 || lj <= 0.5) continue;
      const cost = Math.abs(di) + Math.abs(dj);
      if (cost < bestCost) {
        bestCost = cost;
        const ns = sides.map((s, k) => (k === i ? { ...s, length: round1(li) } : k === j ? { ...s, length: round1(lj) } : s));
        bestPair = { sides: ns, changed: [i, j], residual: walk(ns).gap };
      }
    }
  }
  return bestPair ?? best;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Snaps grid points for the "Draw it myself" fallback (1 square = 1 ft). */
export function snap(p: Pt): Pt {
  return [Math.round(p[0]), Math.round(p[1])];
}

export function sideLengths(points: Pt[]): number[] {
  return points.map((p, i) => {
    const q = points[(i + 1) % points.length]!;
    return round1(Math.hypot(q[0] - p[0], q[1] - p[1]));
  });
}

/**
 * Screen transform: rotate so side 1 sits at the bottom running right to left
 * like the worked example (start at bottom right), then fit into a box.
 */
export function toScreen(points: Pt[], width: number, height: number, pad = 34) {
  const pts = points.map(([x, y]) => [-x, y] as Pt);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const scale = Math.min((width - pad * 2) / w, (height - pad * 2) / h);
  const ox = (width - w * scale) / 2;
  const oy = (height - h * scale) / 2;
  // screen y grows downward; math y negative should go up, so flip: sy = oy + (maxY - y) * scale ... we want side 1 at bottom.
  const out = pts.map(([x, y]) => [ox + (x - minX) * scale, oy + (y - minY) * scale] as Pt);
  // side 1 runs from out[0] to out[1]; ensure it is at the bottom (largest y)
  const s1y = (out[0]![1] + out[1 % out.length]![1]) / 2;
  const avgY = out.reduce((s, p) => s + p[1], 0) / out.length;
  if (s1y < avgY) return { pts: out.map(([x, y]) => [x, height - y] as Pt), scale };
  return { pts: out, scale };
}
