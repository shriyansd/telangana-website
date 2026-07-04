import { describe, it, expect } from 'vitest';
import { updateStreak, addXP, localDay, earnedBadges } from '../src/lib/gamify';
import type { StreakState, XPState } from '../src/types/progress';

const xp0: XPState = {
  total: 0, today: 0, todayDate: '', minutesToday: 0, badges: [],
  lessonsCompleted: 0, reviewSessions: 0, speakingRecordings: 0, storiesCompleted: 0,
};

describe('streaks', () => {
  const day1 = new Date('2026-07-01T09:00:00');
  const day2 = new Date('2026-07-02T21:00:00');
  const day4 = new Date('2026-07-04T09:00:00');

  it('starts at 1 on first activity', () => {
    const s = updateStreak({ current: 0, longest: 0, lastActiveDay: null }, day1);
    expect(s.current).toBe(1);
    expect(s.lastActiveDay).toBe(localDay(day1));
  });

  it('increments on consecutive days and is idempotent within a day', () => {
    let s = updateStreak({ current: 0, longest: 0, lastActiveDay: null }, day1);
    s = updateStreak(s, day2);
    expect(s.current).toBe(2);
    s = updateStreak(s, day2);
    expect(s.current).toBe(2);
  });

  it('one missed day is bridged by the weekly rest day; two missed days reset but keep longest', () => {
    // single missed day (July 3) -> rest day spends, streak continues
    let s: StreakState = { current: 5, longest: 5, lastActiveDay: localDay(day2) };
    s = updateStreak(s, day4);
    expect(s.current).toBe(6);
    // two missed days -> reset, longest preserved
    let t: StreakState = { current: 5, longest: 5, lastActiveDay: localDay(day1) };
    t = updateStreak(t, day4);
    expect(t.current).toBe(1);
    expect(t.longest).toBe(5);
  });
});

describe('XP', () => {
  it('accumulates total and resets daily count on a new day', () => {
    let x = addXP(xp0, 10, new Date('2026-07-01T10:00:00'));
    expect(x.total).toBe(10);
    expect(x.today).toBe(10);
    x = addXP(x, 5, new Date('2026-07-02T10:00:00'));
    expect(x.total).toBe(15);
    expect(x.today).toBe(5);
  });
});

describe('badges', () => {
  it('awards milestone badges without removing earned ones', () => {
    const badges = earnedBadges(
      { ...xp0, lessonsCompleted: 1, badges: ['first-story'] },
      { current: 7, longest: 7, lastActiveDay: '2026-07-02' },
      100,
    );
    expect(badges).toContain('first-lesson');
    expect(badges).toContain('streak-7');
    expect(badges).toContain('concepts-100');
    expect(badges).toContain('first-story');
  });
});

import { updateStreak as us, weekKey } from '../src/lib/gamify';

describe('weekly streak rest day', () => {
  const day = (s: string) => new Date(s + 'T12:00:00');

  it('one missed day is forgiven once per week', () => {
    let s: StreakState = { current: 5, longest: 5, lastActiveDay: '2026-07-01' };
    s = us(s, day('2026-07-03')); // skipped July 2
    expect(s.current).toBe(6);
    expect(s.restUsedWeek).toBe(weekKey(day('2026-07-03')));
  });

  it('a second missed day in the same week resets the streak', () => {
    let s: StreakState = { current: 5, longest: 5, lastActiveDay: '2026-07-01' };
    s = us(s, day('2026-07-03')); // rest day spent
    s = us(s, day('2026-07-05')); // skipped July 4, same week
    expect(s.current).toBe(1);
  });

  it('two consecutive missed days always reset', () => {
    const s = us({ current: 9, longest: 9, lastActiveDay: '2026-07-01' }, day('2026-07-04'));
    expect(s.current).toBe(1);
    expect(s.longest).toBe(9);
  });

  it('normal consecutive days still increment without spending the rest day', () => {
    const s = us({ current: 3, longest: 3, lastActiveDay: '2026-07-02' }, day('2026-07-03'));
    expect(s.current).toBe(4);
    expect(s.restUsedWeek).toBeUndefined();
  });
});
