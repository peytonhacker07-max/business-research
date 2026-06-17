// Date utilities. Everything is keyed on local calendar dates (YYYY-MM-DD)
// so a "day" matches the user's wall clock, not UTC.

/** Local YYYY-MM-DD for a Date (no UTC shift, unlike toISOString). */
export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD key into a local Date at midnight. */
export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toKey(new Date());
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Whole-day difference a - b (positive if a is later). */
export function dayDiff(aKey: string, bKey: string): number {
  return Math.round((fromKey(aKey).getTime() - fromKey(bKey).getTime()) / 86400000);
}

/** Array of YYYY-MM-DD keys for the last `n` days, oldest first, ending today. */
export function lastNDays(n: number, end: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(toKey(addDays(end, -i)));
  return out;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function weekdayShort(d: Date): string {
  return WEEKDAYS[d.getDay()];
}

export function monthShort(monthIndex: number): string {
  return MONTHS[monthIndex];
}

export function formatLong(d: Date): string {
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
