import type { HealthDay } from "./types";
import { todayKey } from "./dates";

/**
 * Apple Health can't be read from a web page — HealthKit is closed to
 * browsers. The way in is an iOS Shortcut, which can read Health and open a
 * URL: it opens this app with the figures after a "#".
 *
 * The fragment is deliberate, not a shortcut in itself. Browsers never send
 * anything after "#" to the server, so the numbers go from the watch to this
 * device and stop. Nothing health-related is ever published or committed.
 */

const FRAGMENT_KEY = "health";

/**
 * Shortcuts hands back Health figures the way a person would read them —
 * "8,432 count", "72 bpm", "7.5 hr" — so a value arrives as a string with
 * separators and a unit stuck to it. Pull the first number out and ignore the
 * rest, rather than making the Shortcut do the tidying.
 */
function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const match = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

/** A number if it's a sane, finite, non-negative value; otherwise undefined. */
function cleanNumber(value: unknown, max: number): number | undefined {
  const n = toNumber(value);
  if (n === undefined || n < 0 || n > max) return undefined;
  return Math.round(n);
}

/**
 * Sleep is the awkward one: Shortcuts measures it in seconds, a person thinks
 * in hours, and the app stores minutes. Accept all three rather than making
 * the Shortcut divide — a unit mistake there would silently look like a
 * sleepless week.
 */
function cleanSleep(raw: Record<string, unknown>): number | undefined {
  const minutes = cleanNumber(raw.sleepMinutes ?? raw.sleep, 24 * 60);
  if (minutes !== undefined) return minutes;

  const seconds = toNumber(raw.sleepSeconds);
  if (seconds !== undefined) return cleanNumber(seconds / 60, 24 * 60);

  const hours = toNumber(raw.sleepHours);
  if (hours !== undefined) return cleanNumber(hours * 60, 24 * 60);

  return undefined;
}

function cleanDay(raw: Record<string, unknown>): HealthDay {
  return {
    // 24h of sleep, 200k steps, 250bpm resting, 20k kcal are all far beyond
    // anything real — they exist to reject garbage, not to judge a day.
    sleepMinutes: cleanSleep(raw),
    steps: cleanNumber(raw.steps, 200000),
    restingHeartRate: cleanNumber(raw.restingHeartRate ?? raw.hr, 250),
    activeEnergy: cleanNumber(raw.activeEnergy ?? raw.energy, 20000),
  };
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Pulls health days out of the URL fragment, accepting either one day or an
 * array of them. Returns an empty object when there's nothing to read, so a
 * normal visit costs nothing.
 */
export function readHealthFromFragment(): Record<string, HealthDay> {
  const hash = window.location.hash;
  if (!hash || !hash.includes(FRAGMENT_KEY)) return {};

  try {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const raw = params.get(FRAGMENT_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(decodeURIComponent(raw));
    const isArray = Array.isArray(parsed);
    const entries = isArray ? parsed : [parsed];

    const out: Record<string, HealthDay> = {};
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      // A single day with no date means "today" — the ordinary case of a
      // Shortcut run now. A list must say which day each figure belongs to,
      // or a backfill would pile every day onto this one.
      const date = isDateKey(record.date) ? record.date : isArray ? undefined : todayKey();
      if (!date) continue;
      const day = cleanDay(record);
      // Skip a day where every figure was missing or nonsense.
      if (Object.values(day).every((v) => v === undefined)) continue;
      out[date] = day;
    }
    return out;
  } catch {
    return {};
  }
}

/** Strips the data from the address bar so it isn't left in history. */
export function clearHealthFragment(): void {
  if (!window.location.hash.includes(FRAGMENT_KEY)) return;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}
