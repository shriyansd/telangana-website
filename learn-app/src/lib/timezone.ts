// Timezone helpers for live sessions. Class times are fixed in Pacific
// wall-clock time, but learners are everywhere — so we resolve each session to
// a real instant (DST included) and render it in the learner's own zone.
// Everything here leans on Intl; no dependency, no hard-coded offsets.
// Pure functions — unit tested in tests/timezone.test.ts.

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface ZoneCivil {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number; // 0–23
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

function partsOf(date: Date, timeZone: string | undefined, opts: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-US', { timeZone, ...opts }).formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = p.value;
  }
  return out;
}

/** The wall-clock calendar reading of `date` inside `timeZone`. */
export function civilInZone(date: Date, timeZone: string): ZoneCivil {
  const p = partsOf(date, timeZone, {
    hourCycle: 'h23', weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24, // some engines render midnight as "24"
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: WEEKDAY_INDEX[p.weekday] ?? 0,
  };
}

/** Offset of `timeZone` from UTC in minutes, at the instant `date` (+330 for IST). */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const c = civilInZone(date, timeZone);
  const asUtc = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/**
 * The instant at which `timeZone` reads the given wall-clock time.
 * (2026-08-29 07:00 in America/Los_Angeles → 14:00 UTC, because that date is PDT.)
 */
export function zonedTimeToInstant(
  year: number, month: number, day: number, hour: number, minute: number, timeZone: string,
): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const guess = wall - tzOffsetMinutes(new Date(wall), timeZone) * 60000;
  // One correction pass: right after a DST change the offset at the first
  // guess differs from the offset at the instant we actually want.
  return new Date(wall - tzOffsetMinutes(new Date(guess), timeZone) * 60000);
}

/**
 * Next instant strictly after `from` where `timeZone` reads `hour:minute` on one
 * of `weekdays` (0 = Sunday). Returns null if none falls in the next two weeks.
 */
export function nextOccurrence(
  weekdays: number[], hour: number, minute: number, timeZone: string, from: Date = new Date(),
): Date | null {
  for (let i = 0; i < 15; i++) {
    const probe = new Date(from.getTime() + i * 86400000);
    const c = civilInZone(probe, timeZone);
    if (!weekdays.includes(c.weekday)) continue;
    const start = zonedTimeToInstant(c.year, c.month, c.day, hour, minute, timeZone);
    if (start.getTime() > from.getTime()) return start;
  }
  return null;
}

/** "7:00 AM" — in `timeZone`, or the learner's own zone when omitted. */
export function formatTime(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone }).format(date);
}

/** "Sat, Aug 29" — in `timeZone`, or the learner's own zone when omitted. */
export function formatDate(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone }).format(date);
}

/** Short zone name at that instant: "PDT", "IST", "GMT+5:30" — engine dependent. */
export function zoneAbbrev(date: Date, timeZone?: string): string {
  return partsOf(date, timeZone, { timeZoneName: 'short' }).timeZoneName ?? '';
}

/** IANA name of the learner's own zone, e.g. "Asia/Kolkata". */
export function localZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
