import type { HealthDay } from "./types";

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

/** A number if it's a sane, finite, non-negative value; otherwise undefined. */
function cleanNumber(value: unknown, max: number): number | undefined {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > max) return undefined;
  return Math.round(n);
}

function cleanDay(raw: Record<string, unknown>): HealthDay {
  return {
    // 24h of sleep, 200k steps, 250bpm resting, 20k kcal are all far beyond
    // anything real — they exist to reject garbage, not to judge a day.
    sleepMinutes: cleanNumber(raw.sleepMinutes ?? raw.sleep, 24 * 60),
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
    const entries = Array.isArray(parsed) ? parsed : [parsed];

    const out: Record<string, HealthDay> = {};
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      if (!isDateKey(record.date)) continue;
      const day = cleanDay(record);
      // Skip a day where every figure was missing or nonsense.
      if (Object.values(day).every((v) => v === undefined)) continue;
      out[record.date] = day;
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
