import { describe, it, expect } from 'vitest';
import { applyAttempt, newMastery, masteryLabel, dueConcepts, INTERVALS_DAYS, selectSupportLevel } from '../src/lib/srs';
import type { AttemptResult } from '../src/lib/srs';

const attempt = (over: Partial<AttemptResult> = {}): AttemptResult => ({
  correct: true, firstTry: true, usedHint: false, responseTimeMs: 3000,
  exerciseType: 'multiple_choice', exerciseId: 'e1', ...over,
});

describe('spaced repetition', () => {
  it('starts new concepts at zero', () => {
    const m = newMastery('c1');
    expect(m.masteryScore).toBe(0);
    expect(masteryLabel(m.masteryScore)).toBe('new');
  });

  it('one correct answer never reaches mastered', () => {
    const m = applyAttempt(newMastery('c1'), attempt());
    expect(m.masteryScore).toBeLessThan(30);
    expect(masteryLabel(m.masteryScore)).not.toBe('mastered');
  });

  it('increases interval up the ladder after successes', () => {
    let m = newMastery('c1');
    const days: number[] = [];
    for (let i = 0; i < 6; i++) {
      m = applyAttempt(m, attempt({ responseTimeMs: 6000 }));
      days.push(m.intervalDays);
    }
    expect(days[0]).toBe(1);
    expect(days).toEqual([...days].sort((a, b) => a - b)); // non-decreasing
    for (const d of days) expect(INTERVALS_DAYS).toContain(d);
  });

  it('reduces interval and mastery after an error', () => {
    let m = newMastery('c1');
    for (let i = 0; i < 4; i++) m = applyAttempt(m, attempt({ responseTimeMs: 6000 }));
    const before = { score: m.masteryScore, interval: m.intervalDays };
    m = applyAttempt(m, attempt({ correct: false }));
    expect(m.masteryScore).toBeLessThan(before.score);
    expect(m.intervalDays).toBeLessThan(before.interval);
    expect(m.recentMistakes).toContain('e1');
  });

  it('penalizes repeated errors more', () => {
    let a = newMastery('c1');
    for (let i = 0; i < 3; i++) a = applyAttempt(a, attempt({ responseTimeMs: 6000 }));
    let single = applyAttempt(a, attempt({ correct: false }));
    let repeated = applyAttempt(single, attempt({ correct: false }));
    const firstDrop = a.masteryScore - single.masteryScore;
    const secondDrop = single.masteryScore - repeated.masteryScore;
    expect(secondDrop).toBeGreaterThan(firstDrop);
  });

  it('gives less credit for hinted answers', () => {
    const clean = applyAttempt(newMastery('c1'), attempt());
    const hinted = applyAttempt(newMastery('c1'), attempt({ usedHint: true }));
    expect(hinted.masteryScore).toBeLessThan(clean.masteryScore);
  });

  it('schedules a same-day retry after an error', () => {
    const now = new Date('2026-07-02T10:00:00Z');
    const m = applyAttempt(newMastery('c1'), attempt({ correct: false }), now);
    expect(m.intervalDays).toBe(0);
    const next = new Date(m.nextReviewAt!);
    expect(next.getTime() - now.getTime()).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it('finds due concepts, most overdue first', () => {
    const now = new Date('2026-07-10T00:00:00Z');
    const overdue = { ...newMastery('a'), timesSeen: 1, nextReviewAt: '2026-07-01T00:00:00Z' };
    const lessOverdue = { ...newMastery('b'), timesSeen: 1, nextReviewAt: '2026-07-08T00:00:00Z' };
    const future = { ...newMastery('c'), timesSeen: 1, nextReviewAt: '2026-08-01T00:00:00Z' };
    const unseen = newMastery('d');
    const due = dueConcepts([lessOverdue, future, overdue, unseen], now);
    expect(due.map((m) => m.conceptId)).toEqual(['a', 'b']);
  });
});

describe('skill dimensions & support levels (v2)', () => {
  it('independent production earns more mastery than recognition', () => {
    const rec = applyAttempt(newMastery('c1'), attempt({ supportLevel: 'recognition' }));
    const prod = applyAttempt(newMastery('c1'), attempt({ supportLevel: 'independent-production', exerciseType: 'translate' }));
    expect(prod.masteryScore).toBeGreaterThan(rec.masteryScore);
  });

  it('a correct answer after reveal gives almost no mastery and holds the interval', () => {
    let m = newMastery('c1');
    m = applyAttempt(m, attempt({ responseTimeMs: 6000 }));
    const before = { score: m.masteryScore, interval: m.intervalDays };
    m = applyAttempt(m, attempt({ answerWasRevealed: true }));
    expect(m.masteryScore - before.score).toBeLessThanOrEqual(1);
    expect(m.intervalDays).toBe(before.interval);
  });

  it('recognition alone cannot exceed the recognition ceiling', () => {
    let m = newMastery('c1');
    for (let i = 0; i < 30; i++) m = applyAttempt(m, attempt({ supportLevel: 'recognition' }));
    expect(m.masteryScore).toBeLessThanOrEqual(65);
    expect(masteryLabel(m.masteryScore)).not.toBe('mastered');
  });

  it('production evidence unlocks mastery above the ceiling', () => {
    let m = newMastery('c1');
    for (let i = 0; i < 20; i++) m = applyAttempt(m, attempt({ supportLevel: 'recognition' }));
    for (let i = 0; i < 8; i++) {
      m = applyAttempt(m, attempt({ supportLevel: 'independent-production', exerciseType: 'translate', skillDimension: 'independent-production' }));
    }
    expect(m.masteryScore).toBeGreaterThan(65);
  });

  it('records per-skill evidence separately', () => {
    let m = newMastery('c1');
    m = applyAttempt(m, attempt({ exerciseType: 'listen_select' }));
    m = applyAttempt(m, attempt({ exerciseType: 'word_tiles', correct: false, errorType: 'word-order' }));
    expect(m.skills?.listening?.successes).toBe(1);
    expect(m.skills?.['supported-production']?.failures).toBe(1);
    expect(m.recentErrorTypes?.[0]).toBe('word-order');
  });

  it('retrieval in a new context earns a transfer bonus', () => {
    const plain = applyAttempt(newMastery('c1'), attempt());
    const transfer = applyAttempt(newMastery('c1'), attempt({ newContext: true }));
    expect(transfer.masteryScore).toBeGreaterThan(plain.masteryScore);
  });

  it('selectSupportLevel moves from recognition toward transfer as mastery grows', () => {
    expect(selectSupportLevel({ masteryScore: 5 })).toBe('recognition');
    expect(selectSupportLevel({ masteryScore: 50 })).toBe('partial-production');
    expect(selectSupportLevel({ masteryScore: 90 })).toBe('transfer');
  });

  it('scheduling is deterministic under simulated future dates', () => {
    const t0 = new Date('2026-07-03T10:00:00Z');
    let m = applyAttempt(newMastery('c1'), attempt({ responseTimeMs: 6000 }), t0);
    expect(m.intervalDays).toBe(1);
    const t1 = new Date('2026-07-05T10:00:00Z'); // 2 days later — overdue
    expect(dueConcepts([m], t1)).toHaveLength(1);
    m = applyAttempt(m, attempt({ responseTimeMs: 6000 }), t1);
    expect(m.intervalDays).toBe(3);
    expect(new Date(m.nextReviewAt!).getTime()).toBe(t1.getTime() + 3 * 86400000);
  });
});
