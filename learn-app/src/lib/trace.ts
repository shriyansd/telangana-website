// Pure geometry for handwriting practice: smooth path building for stroke
// animation, and generous "did the learner roughly follow this stroke?"
// checking. Deliberately NOT handwriting recognition — we compare start point,
// end point, overall direction and coarse shape against the expected stroke,
// with wide tolerances. The goal is muscle-memory reinforcement, not grading.
// Pure functions — unit tested in tests/trace.test.ts.

import type { StrokePoints } from '../content/stroke-data';

export type Pt = [number, number];

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Total polyline length. */
export function pathLength(points: StrokePoints): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += dist(points[i - 1], points[i]);
  return len;
}

/** Resample a polyline to n evenly spaced points (n >= 2). */
export function resample(points: StrokePoints, n: number): StrokePoints {
  if (points.length === 0) return [];
  if (points.length === 1) return Array.from({ length: n }, () => [...points[0]] as Pt);
  const total = pathLength(points);
  if (total === 0) return Array.from({ length: n }, () => [...points[0]] as Pt);
  const step = total / (n - 1);
  const out: StrokePoints = [[...points[0]] as Pt];
  let acc = 0;
  let i = 1;
  let prev: Pt = points[0];
  while (out.length < n - 1 && i < points.length) {
    const d = dist(prev, points[i]);
    if (acc + d >= step) {
      const t = (step - acc) / d;
      const p: Pt = [prev[0] + (points[i][0] - prev[0]) * t, prev[1] + (points[i][1] - prev[1]) * t];
      out.push(p);
      prev = p;
      acc = 0;
    } else {
      acc += d;
      prev = points[i];
      i++;
    }
  }
  while (out.length < n) out.push([...points[points.length - 1]] as Pt);
  return out;
}

/** Smooth SVG path (quadratic through midpoints) from a point sequence. */
export function smoothPath(points: StrokePoints): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i][0] + points[i + 1][0]) / 2;
    const midY = (points[i][1] + points[i + 1][1]) / 2;
    d += ` Q ${points[i][0]} ${points[i][1]} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

export interface StrokeCheck {
  ok: boolean;
  /** What went wrong, for encouraging feedback ('start' | 'end' | 'direction' | 'shape' | 'length'). */
  problem?: 'start' | 'end' | 'direction' | 'shape' | 'length';
}

/**
 * Compare a learner's stroke against the expected one. Coordinates are in the
 * same 0–100 space as stroke-data. `tolerance` is a radius in that space —
 * pass a bigger value at later (memory) stages to stay encouraging.
 */
export function checkStroke(user: StrokePoints, expected: StrokePoints, tolerance = 20): StrokeCheck {
  if (user.length < 2 || expected.length < 2) return { ok: false, problem: 'length' };

  const uLen = pathLength(user);
  const eLen = pathLength(expected);
  // A tap or a wild scribble is not an attempt at this stroke.
  if (uLen < eLen * 0.3 || uLen > eLen * 3) return { ok: false, problem: 'length' };

  if (dist(user[0], expected[0]) > tolerance * 1.4) return { ok: false, problem: 'start' };
  if (dist(user[user.length - 1], expected[expected.length - 1]) > tolerance * 1.4) return { ok: false, problem: 'end' };

  // Overall direction: net displacement vectors should not oppose each other.
  const uv: Pt = [user[user.length - 1][0] - user[0][0], user[user.length - 1][1] - user[0][1]];
  const ev: Pt = [expected[expected.length - 1][0] - expected[0][0], expected[expected.length - 1][1] - expected[0][1]];
  const uMag = Math.hypot(uv[0], uv[1]);
  const eMag = Math.hypot(ev[0], ev[1]);
  // Closed-loop strokes (start ≈ end) have no meaningful net direction — skip.
  if (uMag > tolerance / 2 && eMag > tolerance / 2) {
    const cos = (uv[0] * ev[0] + uv[1] * ev[1]) / (uMag * eMag);
    if (cos < -0.2) return { ok: false, problem: 'direction' };
  }

  // Coarse shape: mean distance between resampled sequences (order-sensitive,
  // so tracing the right shape backwards fails here too).
  const N = 24;
  const ru = resample(user, N);
  const re = resample(expected, N);
  let sum = 0;
  for (let i = 0; i < N; i++) sum += dist(ru[i], re[i]);
  if (sum / N > tolerance) return { ok: false, problem: 'shape' };

  return { ok: true };
}

/** Angle (radians) of the first segment of a stroke — used to rotate arrows. */
export function startAngle(points: StrokePoints): number {
  if (points.length < 2) return 0;
  // Use a point a little along the path so tiny first segments don't flip the arrow.
  const target = resample(points, 8)[1] ?? points[1];
  return Math.atan2(target[1] - points[0][1], target[0] - points[0][0]);
}
