// Orchestrates progress updates when a learner answers an exercise or finishes
// a lesson/review: SRS mastery, mistake records, attempt log, XP and streak.
// All persistence goes through lib/storage.ts.

import type { Exercise, Lesson } from '../types/content';
import type { SkillDimension, SupportLevel } from '../types/progress';
import { applyAttempt, newMastery, inferDimension, inferSupport } from './srs';
import {
  getMastery, saveMastery, getAllMistakes, saveMistake, logAttempt,
  getStreak, saveStreak, getXP, saveXP, getAllMastery,
} from './storage';
import { addXP, updateStreak, XP, earnedBadges, LESSON_REPEAT_XP_FACTOR } from './gamify';
import type { ExerciseOutcome } from '../components/exercises/ExerciseHost';

export async function recordExerciseOutcome(
  exercise: Exercise,
  lessonId: string,
  outcome: ExerciseOutcome,
  opts: { firstTry?: boolean } = {},
): Promise<void> {
  const now = new Date();
  const anyEx = exercise as any;
  const skillDimension = (anyEx.skillDimension as SkillDimension) ??
    inferDimension(exercise.type, { direction: anyEx.direction });
  const supportLevel = (anyEx.supportLevel as SupportLevel) ??
    inferSupport(exercise.type, { hasChoices: !!anyEx.choices?.length, direction: anyEx.direction });
  // Correct only on the second (post-nudge) attempt still counts, with reduced credit.
  const cleanFirstTry = (opts.firstTry ?? true) && (outcome.firstAttemptCorrect ?? true);

  for (const conceptId of exercise.conceptIds ?? []) {
    const existing = (await getMastery(conceptId)) ?? newMastery(conceptId);
    const updated = applyAttempt(existing, {
      correct: outcome.correct,
      firstTry: cleanFirstTry,
      usedHint: outcome.usedHint,
      responseTimeMs: outcome.responseTimeMs,
      exerciseType: exercise.type,
      exerciseId: exercise.id,
      difficulty: exercise.difficulty,
      skillDimension,
      supportLevel,
      newContext: !!anyEx.newContext,
      errorType: outcome.errorType,
    }, now);
    await saveMastery(updated);
  }

  await logAttempt({
    exerciseId: exercise.id,
    lessonId,
    conceptIds: exercise.conceptIds ?? [],
    correct: outcome.correct,
    firstAttemptCorrect: outcome.correct && cleanFirstTry,
    usedHint: outcome.usedHint,
    responseTimeMs: outcome.responseTimeMs,
    answerGiven: outcome.answerGiven,
    skillDimension,
    supportLevel,
    errorType: outcome.errorType,
    at: now.toISOString(),
  });

  if (!outcome.correct) {
    const all = await getAllMistakes();
    const existing = all.find((m) => m.exerciseId === exercise.id);
    await saveMistake({
      exerciseId: exercise.id,
      lessonId,
      conceptIds: exercise.conceptIds ?? [],
      lastMissedAt: now.toISOString(),
      missCount: (existing?.missCount ?? 0) + 1,
      cleared: false,
    });
  }

  // XP per exercise (speaking earns even without grading)
  let amount = XP.exercise;
  if (outcome.correct && !outcome.usedHint) amount += XP.firstTryBonus;
  if (exercise.type === 'speaking') amount += XP.speaking - XP.exercise;
  const xp = await getXP();
  await saveXP(addXP(xp, Math.max(1, amount), now));

  const streak = await getStreak();
  await saveStreak(updateStreak(streak, now));
}

export async function recordSessionComplete(
  kind: 'lesson' | 'review' | 'story',
  opts: { lessonKind?: Lesson['kind']; repeat?: boolean; metGoal?: boolean; minutes?: number } = {},
): Promise<{ xpEarned: number; badgesNew: string[] }> {
  const now = new Date();
  let amount: number = kind === 'lesson' ? XP.lessonComplete : kind === 'review' ? XP.reviewSession : XP.storyComplete;
  if (opts.repeat) amount = Math.max(1, Math.round(amount * LESSON_REPEAT_XP_FACTOR));

  let xp = await getXP();
  const before = new Set(xp.badges);
  xp = addXP(xp, amount, now);
  if (kind === 'lesson') xp = { ...xp, lessonsCompleted: xp.lessonsCompleted + 1 };
  if (kind === 'review') xp = { ...xp, reviewSessions: xp.reviewSessions + 1 };
  if (kind === 'story') xp = { ...xp, storiesCompleted: xp.storiesCompleted + 1 };
  if (opts.minutes) xp = { ...xp, minutesToday: xp.minutesToday + opts.minutes };

  const streak = await saveStreakNow(now);
  const mastery = await getAllMastery();
  const badges = earnedBadges(xp, streak, mastery.length);
  if (opts.lessonKind === 'script') badges.includes('script-start') || badges.push('script-start');
  xp = { ...xp, badges };
  await saveXP(xp);
  return { xpEarned: amount, badgesNew: badges.filter((b) => !before.has(b)) };
}

async function saveStreakNow(now: Date) {
  const s = updateStreak(await getStreak(), now);
  await saveStreak(s);
  return s;
}

/** Tracing stages map onto the existing support ladder (R4): guided tracing is
 *  a full model; drawing from memory is independent production. So handwriting
 *  practice feeds the same per-letter mastery the review system already uses. */
const TRACE_SUPPORT: Record<1 | 2 | 3 | 4, SupportLevel> = {
  1: 'full-model',
  2: 'guided-recall',
  3: 'partial-production',
  4: 'independent-production',
};

export async function recordTraceAttempt(
  conceptId: string,
  stage: 1 | 2 | 3 | 4,
  outcome: { correct: boolean; usedHint: boolean; responseTimeMs: number },
): Promise<void> {
  const now = new Date();
  const exerciseId = `trace-${conceptId}-s${stage}`;
  const existing = (await getMastery(conceptId)) ?? newMastery(conceptId);
  const updated = applyAttempt(existing, {
    correct: outcome.correct,
    firstTry: true,
    usedHint: outcome.usedHint,
    responseTimeMs: outcome.responseTimeMs,
    exerciseType: 'trace',
    exerciseId,
    skillDimension: 'script',
    supportLevel: TRACE_SUPPORT[stage],
  }, now);
  await saveMastery(updated);

  await logAttempt({
    exerciseId,
    lessonId: 'trace-practice',
    conceptIds: [conceptId],
    correct: outcome.correct,
    firstAttemptCorrect: outcome.correct && !outcome.usedHint,
    usedHint: outcome.usedHint,
    responseTimeMs: outcome.responseTimeMs,
    skillDimension: 'script',
    supportLevel: TRACE_SUPPORT[stage],
    at: now.toISOString(),
  });

  let amount = XP.exercise;
  if (outcome.correct && !outcome.usedHint) amount += XP.firstTryBonus;
  const xp = await getXP();
  await saveXP(addXP(xp, Math.max(1, amount), now));
  const streak = await getStreak();
  await saveStreak(updateStreak(streak, now));
}

export async function recordSpeakingRecording(): Promise<void> {
  const xp = await getXP();
  await saveXP({ ...xp, speakingRecordings: xp.speakingRecordings + 1 });
}
