import { describe, it, expect } from 'vitest';
import { civilInZone, tzOffsetMinutes, zonedTimeToInstant, nextOccurrence } from '../src/lib/timezone';

const LA = 'America/Los_Angeles';
const IST = 'Asia/Kolkata';
const SESSION_DAYS = [6, 0]; // Saturday & Sunday

describe('timezone helpers', () => {
  it('reads the civil calendar inside a zone', () => {
    const c = civilInZone(new Date('2026-08-29T14:00:00Z'), LA);
    expect(c).toMatchObject({ year: 2026, month: 8, day: 29, hour: 7, minute: 0, weekday: 6 });
  });

  it('crosses the date line correctly', () => {
    // 17:00 Tuesday in Los Angeles is already Wednesday morning in India.
    const utc = new Date('2026-08-26T00:00:00Z');
    expect(civilInZone(utc, LA)).toMatchObject({ day: 25, weekday: 2 });
    expect(civilInZone(utc, IST)).toMatchObject({ day: 26, weekday: 3 });
  });

  it('reports zone offsets, including DST', () => {
    expect(tzOffsetMinutes(new Date('2026-01-10T15:00:00Z'), LA)).toBe(-480); // PST
    expect(tzOffsetMinutes(new Date('2026-08-29T14:00:00Z'), LA)).toBe(-420); // PDT
    expect(tzOffsetMinutes(new Date('2026-08-29T14:00:00Z'), IST)).toBe(330);
  });

  it('resolves a Pacific wall-clock time to the right instant year-round', () => {
    expect(zonedTimeToInstant(2026, 8, 29, 7, 0, LA).toISOString()).toBe('2026-08-29T14:00:00.000Z');
    expect(zonedTimeToInstant(2026, 1, 10, 7, 0, LA).toISOString()).toBe('2026-01-10T15:00:00.000Z');
  });

  it('stays correct on the days the clocks change', () => {
    // Both 2026 US transitions fall on a Sunday — a session day. 7am is after
    // the 2am switch, so spring-forward is PDT and fall-back is PST.
    expect(zonedTimeToInstant(2026, 3, 8, 7, 0, LA).toISOString()).toBe('2026-03-08T14:00:00.000Z');
    expect(zonedTimeToInstant(2026, 11, 1, 7, 0, LA).toISOString()).toBe('2026-11-01T15:00:00.000Z');
  });

  it('finds the next weekend session from midweek', () => {
    const from = new Date('2026-08-26T00:00:00Z'); // Tuesday evening in LA
    const next = nextOccurrence(SESSION_DAYS, 7, 0, LA, from);
    expect(next?.toISOString()).toBe('2026-08-29T14:00:00.000Z'); // Saturday 7am PDT
  });

  it('skips a session that already started and rolls to the next day', () => {
    const justAfterSaturdayStart = new Date('2026-08-29T14:30:00Z');
    const next = nextOccurrence(SESSION_DAYS, 7, 0, LA, justAfterSaturdayStart);
    expect(next?.toISOString()).toBe('2026-08-30T14:00:00.000Z'); // Sunday 7am PDT
  });

  it('rolls from Sunday round to the following Saturday', () => {
    const sundayAfternoon = new Date('2026-08-30T20:00:00Z');
    const next = nextOccurrence(SESSION_DAYS, 7, 0, LA, sundayAfternoon);
    expect(next?.toISOString()).toBe('2026-09-05T14:00:00.000Z');
  });

  it('returns null when no listed weekday exists (defensive)', () => {
    expect(nextOccurrence([], 7, 0, LA, new Date('2026-08-26T00:00:00Z'))).toBeNull();
  });
});
