import { describe, it, expect } from 'vitest';
import { checkStroke, resample, pathLength, smoothPath, startAngle } from '../src/lib/trace';
import { LETTER_STROKES } from '../src/content/stroke-data';
import { VOWELS, CONSONANTS } from '../src/content/script-data';
import type { StrokePoints } from '../src/content/stroke-data';

const line: StrokePoints = [[20, 50], [80, 50]];

describe('trace geometry', () => {
  it('measures polyline length', () => {
    expect(pathLength(line)).toBe(60);
    expect(pathLength([[0, 0], [3, 4]])).toBe(5);
  });

  it('resamples to evenly spaced points', () => {
    const r = resample(line, 5);
    expect(r).toHaveLength(5);
    expect(r[0]).toEqual([20, 50]);
    expect(r[4]).toEqual([80, 50]);
    expect(r[2][0]).toBeCloseTo(50, 0);
  });

  it('builds a smooth SVG path', () => {
    const d = smoothPath([[10, 10], [50, 50], [90, 10]]);
    expect(d.startsWith('M 10 10')).toBe(true);
    expect(d).toContain('Q');
  });

  it('reports the start direction angle', () => {
    expect(startAngle(line)).toBeCloseTo(0, 1);
    expect(startAngle([[50, 20], [50, 80]])).toBeCloseTo(Math.PI / 2, 1);
  });
});

describe('checkStroke', () => {
  it('accepts a wobbly but honest attempt', () => {
    const wobbly: StrokePoints = [[24, 46], [40, 56], [58, 44], [76, 54]];
    expect(checkStroke(wobbly, line).ok).toBe(true);
  });

  it('rejects tracing in the reverse direction', () => {
    const reversed: StrokePoints = [[80, 50], [50, 50], [20, 50]];
    const r = checkStroke(reversed, line);
    expect(r.ok).toBe(false);
  });

  it('rejects starting far from the stroke start', () => {
    const wrongStart: StrokePoints = [[20, 95], [80, 50]];
    const r = checkStroke(wrongStart, line);
    expect(r.ok).toBe(false);
    expect(r.problem).toBe('start');
  });

  it('rejects a tap or tiny scribble', () => {
    expect(checkStroke([[50, 50], [51, 50]], line).ok).toBe(false);
  });

  it('is more forgiving with a larger tolerance', () => {
    const rough: StrokePoints = [[26, 62], [50, 66], [78, 60]];
    expect(checkStroke(rough, line, 10).ok).toBe(false);
    expect(checkStroke(rough, line, 26).ok).toBe(true);
  });

  it('accepts closed loops without a direction veto', () => {
    const circle = (r: number, cx = 50, cy = 50): StrokePoints =>
      Array.from({ length: 17 }, (_, i) => {
        const a = (i / 16) * 2 * Math.PI;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
      });
    expect(checkStroke(circle(24), circle(20)).ok).toBe(true);
  });
});

describe('stroke data coverage', () => {
  it('covers every vowel and consonant in script-data', () => {
    for (const l of [...VOWELS, ...CONSONANTS]) {
      expect(LETTER_STROKES[l.telugu], `missing strokes for ${l.telugu}`).toBeDefined();
    }
  });

  it('has sane geometry: >=2 points per stroke, inside the 100x100 box', () => {
    for (const [glyph, def] of Object.entries(LETTER_STROKES)) {
      expect(def.strokes.length).toBeGreaterThan(0);
      expect(def.conceptId.startsWith('script-')).toBe(true);
      for (const s of def.strokes) {
        expect(s.length, `stroke in ${glyph}`).toBeGreaterThanOrEqual(2);
        for (const [x, y] of s) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(100);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});
