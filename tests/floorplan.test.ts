// Run with: npm run test:logic
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walk, polygonArea, nearestClosed, mirror, type Side } from '../src/lib/floorplan.ts';

const L: Side[] = [
  { length: 40, turn: 'R' }, { length: 50, turn: 'R' }, { length: 20, turn: 'R' },
  { length: 30, turn: 'L' }, { length: 20, turn: 'R' }, { length: 20, turn: 'R' },
];

test('worked example L shape closes and is 1,400 sq ft', () => {
  const w = walk(L);
  assert.ok(w.gap < 0.001);
  assert.equal(Math.round(polygonArea(w.points)), 1400);
});

test('mirror keeps the area', () => {
  assert.equal(Math.round(polygonArea(mirror(walk(L).points))), 1400);
});

test('all right turns with the same lengths do not close', () => {
  const w = walk(L.map((s) => ({ ...s, turn: 'R' as const })));
  assert.ok(w.gap > 1);
});

test('nearest closed shape fixes a mis-measured side', () => {
  const bad = L.map((s, i) => (i === 2 ? { ...s, length: 25 } : s));
  const fix = nearestClosed(bad)!;
  assert.ok(fix.residual <= 1);
  assert.ok(walk(fix.sides).gap <= 1);
});

test('angled corner uses the law of cosines', () => {
  // 3-4-5 right triangle corner expressed as an angled turn: diagonal 5 between sides 3 and 4
  const w = walk([{ length: 3, turn: 'A', diagonal: 5 }, { length: 4, turn: 'R' }, { length: 5, turn: 'R' }]);
  assert.equal(w.error, undefined);
});
