import type { AppData, HealthDay } from "./types";
import { lastNDays } from "./dates";

/**
 * Observations drawn from the numbers on this device. Every one states
 * something measured — no advice the data doesn't support, and nothing at
 * all until there are enough days to mean anything. A confident-sounding
 * claim from four nights of sleep would be worse than saying nothing.
 */

export interface Insight {
  /** Short headline, e.g. "Sleep is down this week". */
  title: string;
  /** The measurement behind it, in plain language. */
  detail: string;
  tone: "good" | "watch" | "neutral";
}

const MIN_DAYS = 5;

function daysWith<K extends keyof HealthDay>(
  health: Record<string, HealthDay>,
  keys: string[],
  field: K,
): number[] {
  return keys
    .map((k) => health[k]?.[field])
    .filter((v): v is number => typeof v === "number");
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function healthInsights(data: AppData): Insight[] {
  const health = data.health ?? {};
  if (Object.keys(health).length === 0) return [];

  const thisWeek = lastNDays(7);
  const lastWeek = lastNDays(14).slice(0, 7);
  const out: Insight[] = [];

  // --- Sleep, week over week -------------------------------------------
  const sleepNow = daysWith(health, thisWeek, "sleepMinutes");
  const sleepPrev = daysWith(health, lastWeek, "sleepMinutes");
  if (sleepNow.length >= MIN_DAYS) {
    const avg = mean(sleepNow);
    if (sleepPrev.length >= MIN_DAYS) {
      const diff = avg - mean(sleepPrev);
      if (Math.abs(diff) >= 20) {
        out.push({
          title: diff > 0 ? "Sleeping more than last week" : "Sleeping less than last week",
          detail: `${formatDuration(avg)} a night on average, ${formatDuration(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than the week before.`,
          tone: diff > 0 ? "good" : "watch",
        });
      } else {
        out.push({
          title: "Sleep is steady",
          detail: `${formatDuration(avg)} a night on average, about the same as last week.`,
          tone: "neutral",
        });
      }
    } else {
      out.push({
        title: "Sleep this week",
        detail: `${formatDuration(avg)} a night across ${sleepNow.length} nights.`,
        tone: "neutral",
      });
    }

    // Consistency matters as much as the average, and it's measurable.
    const spread = Math.max(...sleepNow) - Math.min(...sleepNow);
    if (spread >= 150) {
      out.push({
        title: "Sleep is uneven",
        detail: `Your shortest and longest nights this week differ by ${formatDuration(spread)}.`,
        tone: "watch",
      });
    }
  }

  // --- Does training change your sleep? --------------------------------
  // Compare the night after a workout day with the night after a rest day.
  const workoutDates = new Set(data.workoutEntries.map((w) => w.date));
  if (workoutDates.size > 0) {
    const span = lastNDays(28);
    const afterWorkout: number[] = [];
    const afterRest: number[] = [];
    for (const date of span) {
      const sleep = health[date]?.sleepMinutes;
      if (typeof sleep !== "number") continue;
      (workoutDates.has(date) ? afterWorkout : afterRest).push(sleep);
    }
    if (afterWorkout.length >= 3 && afterRest.length >= 3) {
      const diff = mean(afterWorkout) - mean(afterRest);
      if (Math.abs(diff) >= 20) {
        out.push({
          title: diff > 0 ? "You sleep longer on workout days" : "You sleep less on workout days",
          detail: `${formatDuration(Math.abs(diff))} ${diff > 0 ? "more" : "less"} on days you trained, across ${afterWorkout.length} workout and ${afterRest.length} rest days.`,
          tone: diff > 0 ? "good" : "watch",
        });
      }
    }
  }

  // --- Resting heart rate ----------------------------------------------
  const hrNow = daysWith(health, thisWeek, "restingHeartRate");
  const hrPrev = daysWith(health, lastWeek, "restingHeartRate");
  if (hrNow.length >= MIN_DAYS && hrPrev.length >= MIN_DAYS) {
    const diff = mean(hrNow) - mean(hrPrev);
    if (Math.abs(diff) >= 3) {
      out.push({
        title: diff < 0 ? "Resting heart rate is down" : "Resting heart rate is up",
        detail: `Averaging ${Math.round(mean(hrNow))} bpm, ${Math.abs(Math.round(diff))} ${diff < 0 ? "lower" : "higher"} than last week.`,
        tone: diff < 0 ? "good" : "watch",
      });
    }
  }

  // --- Steps ------------------------------------------------------------
  const stepsNow = daysWith(health, thisWeek, "steps");
  const stepsPrev = daysWith(health, lastWeek, "steps");
  if (stepsNow.length >= MIN_DAYS) {
    const avg = Math.round(mean(stepsNow));
    if (stepsPrev.length >= MIN_DAYS) {
      const diff = avg - mean(stepsPrev);
      const pct = Math.round((diff / mean(stepsPrev)) * 100);
      if (Math.abs(pct) >= 10) {
        out.push({
          title: pct > 0 ? "Moving more than last week" : "Moving less than last week",
          detail: `${avg.toLocaleString()} steps a day, ${Math.abs(pct)}% ${pct > 0 ? "up on" : "down on"} the week before.`,
          tone: pct > 0 ? "good" : "watch",
        });
      }
    } else {
      out.push({
        title: "Steps this week",
        detail: `${avg.toLocaleString()} a day across ${stepsNow.length} days.`,
        tone: "neutral",
      });
    }
  }

  return out;
}

/** How many days of data exist — used to explain an empty insights list. */
export function healthDayCount(data: AppData): number {
  return Object.keys(data.health ?? {}).length;
}
