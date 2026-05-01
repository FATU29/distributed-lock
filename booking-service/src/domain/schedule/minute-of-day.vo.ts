/**
 * Minutes since midnight in the dealership's local clock. The booking
 * flow currently treats this as UTC; a per-dealership timezone is a
 * future addition.
 */
export const MINUTES_PER_DAY = 24 * 60;

export function assertMinuteOfDay(raw: number, label: string): number {
  if (!Number.isInteger(raw) || raw < 0 || raw > MINUTES_PER_DAY) {
    throw new Error(`${label} must be an integer minute-of-day in 0..1440`);
  }
  return raw;
}

export function utcMinuteOfDay(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}
