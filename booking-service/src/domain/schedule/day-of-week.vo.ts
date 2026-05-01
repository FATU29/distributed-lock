/**
 * 0 = Sunday … 6 = Saturday — matches `Date.prototype.getUTCDay()` so a
 * slot's weekday can be derived without a calendar library.
 */
export const dayOfWeekValues = [0, 1, 2, 3, 4, 5, 6] as const;
export type DayOfWeek = (typeof dayOfWeekValues)[number];

export function assertDayOfWeek(raw: number): DayOfWeek {
  if (!Number.isInteger(raw) || raw < 0 || raw > 6) {
    throw new Error('day_of_week must be an integer in 0..6');
  }
  return raw as DayOfWeek;
}

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};
