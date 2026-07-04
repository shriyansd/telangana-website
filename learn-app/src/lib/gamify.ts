// XP, streaks, and badges. Pure calculation functions (tested) plus thin
// persistence helpers. No lives, no energy, no shame mechanics.

import type { StreakState, XPState } from '../types/progress';

export const XP = {
  exercise: 2,
  firstTryBonus: 2,
  lessonComplete: 10,
  reviewSession: 8,
  speaking: 4,
  storyComplete: 12,
  dailyGoalBonus: 5,
} as const;

/** Per-lesson XP cap discourages farming the same easy lesson. */
export const LESSON_REPEAT_XP_FACTOR = 0.3;

export function localDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ISO-week-ish key (year + week number) for the rest-day allowance. */
export function weekKey(d: Date): string {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const jan1 = new Date(t.getFullYear(), 0, 1);
  const week = Math.floor(((t.getTime() - jan1.getTime()) / 86400000 + jan1.getDay()) / 7);
  return `${t.getFullYear()}-w${week}`;
}

/**
 * Streaks with a weekly rest day (P4/R10: streaks motivate, but rigid ones
 * breed compulsion — Mogavi et al. 2022). Missing exactly one day is forgiven
 * once per calendar week; the streak continues instead of resetting.
 */
export function updateStreak(s: StreakState, now: Date = new Date()): StreakState {
  const today = localDay(now);
  if (s.lastActiveDay === today) return s;
  const yesterday = localDay(new Date(now.getTime() - 86400000));
  const dayBefore = localDay(new Date(now.getTime() - 2 * 86400000));
  if (s.lastActiveDay === yesterday) {
    const current = s.current + 1;
    return { ...s, current, longest: Math.max(s.longest, current), lastActiveDay: today };
  }
  const wk = weekKey(now);
  if (s.lastActiveDay === dayBefore && s.current > 0 && s.restUsedWeek !== wk) {
    // one missed day, rest day available this week → streak survives
    const current = s.current + 1;
    return { current, longest: Math.max(s.longest, current), lastActiveDay: today, restUsedWeek: wk };
  }
  return { ...s, current: 1, longest: Math.max(s.longest, 1), lastActiveDay: today };
}

export function addXP(x: XPState, amount: number, now: Date = new Date()): XPState {
  const today = localDay(now);
  const sameDay = x.todayDate === today;
  return {
    ...x,
    total: x.total + amount,
    today: (sameDay ? x.today : 0) + amount,
    todayDate: today,
    minutesToday: sameDay ? x.minutesToday : 0,
  };
}

export function addMinutes(x: XPState, minutes: number, now: Date = new Date()): XPState {
  const today = localDay(now);
  const sameDay = x.todayDate === today;
  return { ...x, todayDate: today, today: sameDay ? x.today : 0, minutesToday: (sameDay ? x.minutesToday : 0) + minutes };
}

export interface BadgeDef { id: string; title: string; description: string; icon: string }

export const BADGES: BadgeDef[] = [
  { id: 'first-lesson', title: 'First Step', description: 'Completed your first lesson', icon: '🌱' },
  { id: 'streak-7', title: 'One Week', description: 'Practiced 7 days in a row', icon: '🔥' },
  { id: 'first-sentence', title: 'First Sentence', description: 'Read your first Telugu sentence', icon: '📖' },
  { id: 'first-recording', title: 'Found Your Voice', description: 'Made your first speaking recording', icon: '🎙️' },
  { id: 'first-story', title: 'Storyteller', description: 'Completed your first story', icon: '📚' },
  { id: 'review-10', title: 'Reviewer', description: 'Completed 10 review sessions', icon: '🔁' },
  { id: 'script-start', title: 'Script Explorer', description: 'Completed a Telugu script lesson', icon: '✍️' },
  { id: 'concepts-100', title: 'Century', description: 'Practiced 100 concepts', icon: '💯' },
];

export function earnedBadges(x: XPState, streak: StreakState, conceptsPracticed: number): string[] {
  const out = new Set(x.badges);
  if (x.lessonsCompleted >= 1) out.add('first-lesson');
  if (streak.current >= 7 || streak.longest >= 7) out.add('streak-7');
  if (x.speakingRecordings >= 1) out.add('first-recording');
  if (x.storiesCompleted >= 1) out.add('first-story');
  if (x.reviewSessions >= 10) out.add('review-10');
  if (conceptsPracticed >= 100) out.add('concepts-100');
  return Array.from(out);
}
