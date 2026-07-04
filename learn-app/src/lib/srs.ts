// Deterministic spaced-repetition scheduler. Transparent rules, no AI.
// Interval ladder 0 → 1 → 3 → 7 → 14 → 30 → 60 days — implementation defaults,
// not claimed optimal (R1: no universally best sequence; spacing itself is what
// matters). Credit scales with support level (R4), hints reduce it (R6), and
// recognition alone cannot reach the top mastery bands — production evidence is
// required. Pure functions — unit tested in tests/srs.test.ts.

import type { ConceptMastery, SkillDimension, SupportLevel, ErrorType } from '../types/progress';

export const INTERVALS_DAYS = [0, 1, 3, 7, 14, 30, 60];

/** Mastery ceiling while a concept has only recognition evidence (R4). */
export const RECOGNITION_ONLY_CEILING = 65;

export interface AttemptResult {
  correct: boolean;
  firstTry: boolean;
  usedHint: boolean;
  responseTimeMs: number;
  exerciseType: string;
  exerciseId: string;
  difficulty?: number; // 1..3
  skillDimension?: SkillDimension;
  supportLevel?: SupportLevel;
  /** correct only after the answer was revealed → little/no mastery gain */
  answerWasRevealed?: boolean;
  /** the concept was retrieved in a new context → stronger transfer signal (R1) */
  newContext?: boolean;
  errorType?: ErrorType;
}

/** Relative mastery credit by how much help the learner had (R4). */
const SUPPORT_CREDIT: Record<SupportLevel, number> = {
  'full-model': 0.2,
  recognition: 0.6,
  'guided-recall': 0.8,
  'partial-production': 1.0,
  'independent-production': 1.2,
  transfer: 1.4,
};

const PRODUCTIVE_DIMENSIONS: SkillDimension[] = ['supported-production', 'independent-production', 'script', 'communicative-use'];

/** Map an exercise type to the skill dimension it gives evidence about. */
export function inferDimension(exerciseType: string, opts: { direction?: string } = {}): SkillDimension {
  switch (exerciseType) {
    case 'listen_select': return 'listening';
    case 'sound_compare': return 'pronunciation-perception';
    case 'dictation': return 'script';
    case 'script_build': return 'script';
    case 'word_tiles': return 'supported-production';
    case 'fill_blank': return 'supported-production';
    case 'translate': return opts.direction === 'to-telugu' ? 'independent-production' : 'reading';
    case 'dialogue': return 'communicative-use';
    case 'story_checkpoint': return 'reading';
    case 'speaking': return 'communicative-use';
    case 'image_match': return 'meaning';
    case 'match_pairs': return 'meaning';
    case 'categorize': return 'meaning';
    default: return 'meaning';
  }
}

/** Map an exercise to how much support it gives (overridable in content). */
export function inferSupport(exerciseType: string, opts: { hasChoices?: boolean; direction?: string } = {}): SupportLevel {
  switch (exerciseType) {
    case 'listen_select':
    case 'multiple_choice':
    case 'image_match':
    case 'match_pairs':
    case 'sound_compare':
    case 'script_build':
    case 'story_checkpoint':
    case 'categorize':
      return 'recognition';
    case 'word_tiles': return 'guided-recall';
    case 'fill_blank': return opts.hasChoices ? 'guided-recall' : 'partial-production';
    case 'dictation': return 'partial-production';
    case 'translate': return 'independent-production';
    case 'dialogue': return opts.hasChoices ? 'guided-recall' : 'independent-production';
    case 'speaking': return 'independent-production';
    default: return 'recognition';
  }
}

/**
 * Recommend how much support the next exercise for a concept should give,
 * based on current mastery (R4: recognition first, production as it grows).
 */
export function selectSupportLevel(m: Pick<ConceptMastery, 'masteryScore' | 'skills'>): SupportLevel {
  const s = m.masteryScore;
  if (s <= 20) return 'recognition';
  if (s <= 40) return 'guided-recall';
  if (s <= 60) return 'partial-production';
  if (s <= 80) return 'independent-production';
  return 'transfer';
}

export function newMastery(conceptId: string): ConceptMastery {
  return {
    conceptId,
    masteryScore: 0,
    timesSeen: 0,
    correctCount: 0,
    incorrectCount: 0,
    correctStreak: 0,
    incorrectStreak: 0,
    lastReviewedAt: null,
    nextReviewAt: null,
    intervalDays: 0,
    lastExerciseTypes: [],
    recentMistakes: [],
  };
}

export function masteryLabel(score: number): 'new' | 'learning' | 'familiar' | 'strong' | 'mastered' {
  if (score <= 20) return 'new';
  if (score <= 40) return 'learning';
  if (score <= 60) return 'familiar';
  if (score <= 80) return 'strong';
  return 'mastered';
}

function nextIntervalUp(current: number, fast: boolean): number {
  const idx = INTERVALS_DAYS.findIndex((d) => d >= current);
  const at = idx === -1 ? INTERVALS_DAYS.length - 1 : idx;
  const bump = fast ? 2 : 1;
  return INTERVALS_DAYS[Math.min(at + bump, INTERVALS_DAYS.length - 1)];
}

function intervalDown(current: number): number {
  const idx = INTERVALS_DAYS.findIndex((d) => d >= current);
  const at = idx === -1 ? INTERVALS_DAYS.length - 1 : idx;
  return INTERVALS_DAYS[Math.max(at - 2, 0)];
}

/**
 * Apply one exercise attempt to a concept's mastery record.
 * Returns a new record (pure).
 */
export function applyAttempt(m: ConceptMastery, r: AttemptResult, now: Date = new Date()): ConceptMastery {
  const out: ConceptMastery = {
    ...m,
    lastExerciseTypes: [...m.lastExerciseTypes],
    recentMistakes: [...m.recentMistakes],
    skills: { ...(m.skills ?? {}) },
    recentErrorTypes: [...(m.recentErrorTypes ?? [])],
  };
  out.timesSeen += 1;
  out.lastReviewedAt = now.toISOString();
  out.lastExerciseTypes = [r.exerciseType, ...out.lastExerciseTypes].slice(0, 5);

  const diff = Math.min(Math.max(r.difficulty ?? 1, 1), 3);
  const dimension = r.skillDimension ?? inferDimension(r.exerciseType);
  const support = r.supportLevel ?? inferSupport(r.exerciseType);
  const supportFactor = SUPPORT_CREDIT[support] ?? 1;

  // per-skill evidence record
  const skill = out.skills![dimension] ?? { score: 0, successes: 0, failures: 0, lastAttemptAt: null };
  skill.lastAttemptAt = now.toISOString();

  if (r.correct) {
    out.correctCount += 1;
    out.correctStreak += 1;
    out.incorrectStreak = 0;
    skill.successes += 1;

    // Credit: scaled by support (R4); reduced after retry; minimal with a hint
    // (R6); ~nothing when the answer had been revealed first.
    let delta = r.firstTry ? (10 + 2 * diff) * supportFactor : 4 * supportFactor;
    if (r.usedHint) delta = 2;
    if (r.answerWasRevealed) delta = 1;
    if (r.newContext) delta += 4; // transfer signal (R1)
    delta = Math.round(delta);
    out.masteryScore = Math.min(100, out.masteryScore + delta);
    skill.score = Math.min(100, skill.score + delta);

    // Recognition alone cannot certify mastery: without any successful
    // production evidence the overall score is capped (R4).
    const hasProduction = PRODUCTIVE_DIMENSIONS.some((d) => (out.skills![d]?.successes ?? 0) > 0);
    if (!hasProduction) out.masteryScore = Math.min(out.masteryScore, RECOGNITION_ONLY_CEILING);

    const fast = r.responseTimeMs > 0 && r.responseTimeMs < 4000 && out.masteryScore > 60;
    // Hinted or revealed answers hold the interval; otherwise move up the ladder.
    out.intervalDays = (r.usedHint || r.answerWasRevealed)
      ? Math.max(out.intervalDays, 1)
      : nextIntervalUp(out.intervalDays, fast);
  } else {
    out.incorrectCount += 1;
    out.incorrectStreak += 1;
    out.correctStreak = 0;
    skill.failures += 1;
    const penalty = out.incorrectStreak >= 2 ? 14 : 8;
    out.masteryScore = Math.max(0, out.masteryScore - penalty);
    skill.score = Math.max(0, skill.score - penalty);
    out.intervalDays = intervalDown(out.intervalDays);
    out.recentMistakes = [r.exerciseId, ...out.recentMistakes].slice(0, 5);
    if (r.errorType) out.recentErrorTypes = [r.errorType, ...out.recentErrorTypes!].slice(0, 5);
  }
  out.skills![dimension] = skill;

  if (r.responseTimeMs > 0) {
    out.averageResponseTimeMs = out.averageResponseTimeMs
      ? Math.round(out.averageResponseTimeMs * 0.7 + r.responseTimeMs * 0.3)
      : r.responseTimeMs;
  }

  const next = new Date(now);
  if (out.intervalDays === 0) {
    next.setMinutes(next.getMinutes() + 10); // again later this session / today
  } else {
    next.setDate(next.getDate() + out.intervalDays);
  }
  out.nextReviewAt = next.toISOString();
  return out;
}

/** Concepts due for review, most overdue first. */
export function dueConcepts(all: ConceptMastery[], now: Date = new Date()): ConceptMastery[] {
  return all
    .filter((m) => m.timesSeen > 0 && m.nextReviewAt !== null && new Date(m.nextReviewAt) <= now)
    .sort((a, b) => new Date(a.nextReviewAt!).getTime() - new Date(b.nextReviewAt!).getTime());
}
