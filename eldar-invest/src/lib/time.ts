export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/**
 * A "day number" is the count of calendar days since 1970-01-01 in the
 * user's local calendar. It is stable for a given local date.
 */
export function dayNumber(t: number): number {
  const d = new Date(t);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}

/** Local-midnight timestamp for a given day number. */
export function dayStart(day: number): number {
  const u = new Date(day * DAY);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()).getTime();
}

export function dayEnd(day: number): number {
  return dayStart(day + 1);
}
