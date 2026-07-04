import { describe, it, expect } from 'vitest';
import { buildLessonSession, spreadTypes, requeueMissed, planReview, exercisesForConcepts, rng } from '../src/lib/session';
import { newMastery } from '../src/lib/srs';
import type { Exercise, Lesson } from '../src/types/content';

const mkEx = (id: string, type: string, concepts: string[] = ['c1']): Exercise =>
  ({ id, type, conceptIds: concepts } as unknown as Exercise);

const lesson: Lesson = {
  id: 'l1', courseId: 'c', unitId: 'u', title: 't', description: '', estimatedMinutes: 5,
  status: 'draft', difficulty: 'beginner', learnerPaths: ['complete-beginner'],
  prerequisites: [], conceptIds: ['c1', 'c2'],
  exercises: [
    mkEx('e1', 'translate', ['c1']),
    mkEx('e2', 'listen_select', ['c1']),
    mkEx('e3', 'multiple_choice', ['c2']),
    mkEx('e4', 'word_tiles', ['c2']),
    mkEx('e5', 'dictation', ['c1']),
  ],
} as Lesson;

describe('session generation', () => {
  it('puts receptive exercises before productive ones', () => {
    const session = buildLessonSession(lesson, 42);
    const ids = session.map((e) => e.id);
    expect(ids.indexOf('e2')).toBeLessThan(ids.indexOf('e1'));
    expect(ids.indexOf('e3')).toBeLessThan(ids.indexOf('e4'));
    expect(session).toHaveLength(5);
  });

  it('is deterministic for a given seed', () => {
    const a = buildLessonSession(lesson, 7).map((e) => e.id);
    const b = buildLessonSession(lesson, 7).map((e) => e.id);
    expect(a).toEqual(b);
  });

  it('spreadTypes breaks runs of three same-type exercises', () => {
    const run = [
      mkEx('a', 'multiple_choice'), mkEx('b', 'multiple_choice'), mkEx('c', 'multiple_choice'),
      mkEx('d', 'word_tiles'), mkEx('e', 'multiple_choice'),
    ];
    const spread = spreadTypes(run);
    for (let i = 2; i < spread.length; i++) {
      const three = [spread[i - 2].type, spread[i - 1].type, spread[i].type];
      expect(new Set(three).size).toBeGreaterThan(1);
    }
  });

  it('requeues a missed exercise 2–4 positions later', () => {
    const queue = [mkEx('a', 'x'), mkEx('b', 'x'), mkEx('c', 'x'), mkEx('d', 'x'), mkEx('e', 'x')];
    const missed = mkEx('missed', 'x');
    const out = requeueMissed(queue, missed, rng(3));
    const pos = out.findIndex((e) => e.id === 'missed');
    expect(pos).toBeGreaterThanOrEqual(2);
    expect(pos).toBeLessThanOrEqual(4);
    expect(out).toHaveLength(6);
  });
});

describe('review planning', () => {
  it('prioritizes concepts with recent mistakes, then most overdue', () => {
    const now = new Date('2026-07-10T00:00:00Z');
    const overdue = { ...newMastery('old'), timesSeen: 3, nextReviewAt: '2026-07-01T00:00:00Z' };
    const mistake = { ...newMastery('miss'), timesSeen: 3, nextReviewAt: '2026-07-09T00:00:00Z', recentMistakes: ['e9'] };
    const plan = planReview([overdue, mistake], { now, random: rng(1) });
    expect(plan[0].conceptId).toBe('miss');
    expect(plan[1].conceptId).toBe('old');
  });

  it('ignores unseen concepts and respects max', () => {
    const now = new Date('2026-07-10T00:00:00Z');
    const seen = Array.from({ length: 20 }, (_, i) => ({
      ...newMastery(`c${i}`), timesSeen: 1, nextReviewAt: '2026-07-01T00:00:00Z',
    }));
    const unseen = newMastery('fresh');
    const plan = planReview([...seen, unseen], { now, max: 5, random: rng(1) });
    expect(plan).toHaveLength(5);
    expect(plan.every((p) => p.conceptId !== 'fresh')).toBe(true);
  });

  it('collects exercises for concepts without duplicates', () => {
    const picked = exercisesForConcepts(['c1', 'c2'], [lesson], { max: 4, random: rng(2) });
    const ids = picked.map((p) => p.exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.length).toBeLessThanOrEqual(4);
  });
});
