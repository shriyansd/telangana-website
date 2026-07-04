// Session generation: orders a lesson's authored exercises so that new concepts
// are introduced before unsupported production, exercise types are interleaved,
// and missed exercises come back later in the same session. Also builds mixed
// review sessions from due concepts. Deterministic given a seed — tested.

import type { Exercise, Lesson } from '../types/content';
import type { ConceptMastery } from '../types/progress';

/** Small seeded PRNG (mulberry32) so sessions are testable and varied. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const RECEPTIVE: string[] = ['listen_select', 'multiple_choice', 'image_match', 'match_pairs', 'sound_compare', 'script_build', 'story_checkpoint', 'categorize'];

/**
 * Order lesson exercises for a session:
 * 1. Receptive exercises for a concept come before productive ones.
 * 2. No more than two consecutive exercises of the same type where avoidable.
 */
export function buildLessonSession(lesson: Lesson, seed = Date.now()): Exercise[] {
  // Checkpoints (unit reviews / performance tasks) are authored as a coherent
  // sequence — a conversation must play in order, never shuffled.
  if (lesson.kind === 'checkpoint') return [...lesson.exercises];
  const random = rng(seed);
  const receptive: Exercise[] = [];
  const productive: Exercise[] = [];
  for (const ex of lesson.exercises) {
    (RECEPTIVE.includes(ex.type) ? receptive : productive).push(ex);
  }
  // Keep authored order within each band (authors control introduction order),
  // with a light shuffle of productive items only.
  const ordered = [...receptive, ...shuffle(productive, random)];
  return spreadTypes(ordered);
}

/** Avoid long runs of the same exercise type without reordering across concepts too aggressively. */
export function spreadTypes(exercises: Exercise[]): Exercise[] {
  const out = [...exercises];
  for (let i = 2; i < out.length; i++) {
    if (out[i].type === out[i - 1].type && out[i].type === out[i - 2].type) {
      const j = out.findIndex((e, k) => k > i && e.type !== out[i].type);
      if (j !== -1) {
        const [moved] = out.splice(j, 1);
        out.splice(i, 0, moved);
      }
    }
  }
  return out;
}

/** Insert a missed exercise again 2–4 positions later in the remaining queue. */
export function requeueMissed(queue: Exercise[], missed: Exercise, random: () => number = Math.random): Exercise[] {
  const pos = Math.min(queue.length, 2 + Math.floor(random() * 3));
  const out = [...queue];
  out.splice(pos, 0, missed);
  return out;
}

export interface ReviewPlanItem {
  conceptId: string;
  masteryScore: number;
  overdueDays: number;
}

/**
 * Choose concepts for a review session: overdue first, recent mistakes boosted,
 * plus an occasional well-mastered concept to keep old material alive.
 */
export function planReview(
  mastery: ConceptMastery[],
  opts: { max?: number; now?: Date; random?: () => number } = {},
): ReviewPlanItem[] {
  const now = opts.now ?? new Date();
  const max = opts.max ?? 10;
  const random = opts.random ?? Math.random;

  const seen = mastery.filter((m) => m.timesSeen > 0);
  const due = seen
    .filter((m) => m.nextReviewAt && new Date(m.nextReviewAt) <= now)
    .sort((a, b) => {
      // recent-mistake concepts first, then most overdue
      const mistakeDelta = (b.recentMistakes.length > 0 ? 1 : 0) - (a.recentMistakes.length > 0 ? 1 : 0);
      if (mistakeDelta !== 0) return mistakeDelta;
      return new Date(a.nextReviewAt!).getTime() - new Date(b.nextReviewAt!).getTime();
    });

  const picked = due.slice(0, max);

  // ~20% of slots (if free) go to a mastered concept for long-term retention.
  if (picked.length < max) {
    const mastered = seen.filter((m) => m.masteryScore > 80 && !picked.includes(m));
    const extras = Math.min(max - picked.length, Math.ceil(max * 0.2));
    for (let i = 0; i < extras && mastered.length > 0; i++) {
      const idx = Math.floor(random() * mastered.length);
      picked.push(mastered.splice(idx, 1)[0]);
    }
  }

  return picked.map((m) => ({
    conceptId: m.conceptId,
    masteryScore: m.masteryScore,
    overdueDays: m.nextReviewAt ? Math.max(0, (now.getTime() - new Date(m.nextReviewAt).getTime()) / 86400000) : 0,
  }));
}

/**
 * Collect exercises that practice the given concepts, avoiding duplicate prompts
 * and long runs of one type. Used for review and mistake practice.
 */
export function exercisesForConcepts(
  conceptIds: string[],
  allLessons: Lesson[],
  opts: { max?: number; random?: () => number } = {},
): { exercise: Exercise; lessonId: string }[] {
  const max = opts.max ?? 12;
  const random = opts.random ?? Math.random;
  const wanted = new Set(conceptIds);
  const pool: { exercise: Exercise; lessonId: string }[] = [];
  for (const lesson of allLessons) {
    for (const ex of lesson.exercises) {
      if (ex.conceptIds.some((c) => wanted.has(c))) pool.push({ exercise: ex, lessonId: lesson.id });
    }
  }
  // one exercise per concept first, then fill
  const byConcept = new Map<string, { exercise: Exercise; lessonId: string }[]>();
  for (const item of pool) {
    for (const c of item.exercise.conceptIds) {
      if (!wanted.has(c)) continue;
      if (!byConcept.has(c)) byConcept.set(c, []);
      byConcept.get(c)!.push(item);
    }
  }
  const out: { exercise: Exercise; lessonId: string }[] = [];
  const usedIds = new Set<string>();
  for (const c of conceptIds) {
    const options = (byConcept.get(c) ?? []).filter((i) => !usedIds.has(i.exercise.id));
    if (options.length > 0) {
      const pick = options[Math.floor(random() * options.length)];
      out.push(pick);
      usedIds.add(pick.exercise.id);
    }
  }
  for (const item of shuffle(pool, random)) {
    if (out.length >= max) break;
    if (!usedIds.has(item.exercise.id)) {
      out.push(item);
      usedIds.add(item.exercise.id);
    }
  }
  const spread = spreadTypes(out.map((o) => o.exercise));
  return spread.map((ex) => out.find((o) => o.exercise.id === ex.id)!).slice(0, max);
}
