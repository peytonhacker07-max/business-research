import type { AppData, WorkoutEntry } from "./types";
import { lastNDays, todayKey } from "./dates";
import { dayTotals, macroTargets } from "./nutrition";

/**
 * The coach.
 *
 * Everything here is arithmetic on what you logged — no model, no API, no
 * monthly bill. The rule it follows is the same one the health insights
 * follow: say only what the numbers support, and say nothing until there is
 * enough of them. A training app that invents encouragement is worse than
 * one that stays quiet, because you stop being able to tell the difference
 * when it does have something to say.
 */

export interface CoachNote {
  title: string;
  detail: string;
  tone: "good" | "watch" | "neutral";
}

export type Readiness = "push" | "normal" | "ease" | "unknown";

export interface ReadinessCall {
  level: Readiness;
  headline: string;
  reasons: string[];
}

/** Lower-body lifts move up in bigger jumps than upper-body ones. */
const LOWER_BODY = [
  "squat",
  "deadlift",
  "rdl",
  "romanian",
  "leg press",
  "leg curl",
  "leg extension",
  "lunge",
  "hip thrust",
  "calf",
  "glute",
];

function isLowerBody(exercise: string): boolean {
  const e = exercise.toLowerCase();
  return LOWER_BODY.some((k) => e.includes(k));
}

/** The jump to suggest when a lift is ready to move up, in pounds. */
function increment(exercise: string): number {
  return isLowerBody(exercise) ? 10 : 5;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** One session of one exercise, collapsed to the numbers that matter. */
export interface SessionSummary {
  date: string;
  /** Heaviest weight used that day. */
  topWeight: number;
  /** Reps achieved at the top weight, summed across sets at that weight. */
  topReps: number;
  /** sets x reps x weight across every set of the exercise. */
  volume: number;
}

/** Every session of one exercise, oldest first. */
export function exerciseHistory(data: AppData, exercise: string): SessionSummary[] {
  const key = exercise.trim().toLowerCase();
  const byDate = new Map<string, WorkoutEntry[]>();

  for (const w of data.workoutEntries) {
    if (w.exercise.trim().toLowerCase() !== key) continue;
    const list = byDate.get(w.date);
    if (list) list.push(w);
    else byDate.set(w.date, [w]);
  }

  return [...byDate.entries()]
    .map(([date, entries]) => {
      const topWeight = Math.max(...entries.map((e) => e.weight));
      const atTop = entries.filter((e) => e.weight === topWeight);
      return {
        date,
        topWeight,
        topReps: atTop.reduce((sum, e) => sum + e.sets * e.reps, 0),
        volume: entries.reduce((sum, e) => sum + e.sets * e.reps * e.weight, 0),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Every exercise logged, most recently trained first. */
export function loggedExercises(data: AppData): string[] {
  const last = new Map<string, string>();
  for (const w of data.workoutEntries) {
    const name = w.exercise.trim();
    const prev = last.get(name);
    if (!prev || w.date > prev) last.set(name, w.date);
  }
  return [...last.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .map(([name]) => name);
}

export interface Suggestion {
  exercise: string;
  weight: number;
  reps: number;
  reason: string;
  /** True when the lift hasn't moved in three sessions or more. */
  stalled: boolean;
  /** How many sessions in a row have used this same top weight. */
  sessionsAtWeight: number;
}

/**
 * What to put on the bar next time. The logic is deliberately the boring
 * one every beginner programme uses: if the last session matched or beat the
 * one before it, add weight; if the same load has sat there for three
 * sessions, the suggestion is to change something rather than grind.
 */
export function suggestNext(data: AppData, exercise: string): Suggestion | undefined {
  const history = exerciseHistory(data, exercise);
  if (history.length === 0) return undefined;

  const last = history[history.length - 1];
  if (last.topWeight <= 0) return undefined;

  const step = increment(exercise);
  const repsTarget = Math.max(1, Math.round(last.topReps / Math.max(1, countSets(data, exercise, last.date))));

  // How many sessions in a row have used this same top weight?
  let sameWeight = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].topWeight === last.topWeight) sameWeight += 1;
    else break;
  }

  if (sameWeight >= 3) {
    return {
      exercise,
      weight: last.topWeight,
      reps: repsTarget + 1,
      stalled: true,
      sessionsAtWeight: sameWeight,
      reason: `${last.topWeight} lb hasn't moved in ${sameWeight} sessions. Add a rep before adding weight, or drop 10% and build back.`,
    };
  }

  const prev = history.length >= 2 ? history[history.length - 2] : undefined;
  const heldOrBeat = !prev || last.volume >= prev.volume;

  if (heldOrBeat) {
    return {
      exercise,
      weight: last.topWeight + step,
      reps: repsTarget,
      stalled: false,
      sessionsAtWeight: sameWeight,
      reason: `Last time: ${last.topWeight} lb. Volume held, so take it up ${step} lb.`,
    };
  }

  return {
    exercise,
    weight: last.topWeight,
    reps: repsTarget,
    stalled: false,
    sessionsAtWeight: sameWeight,
    reason: `Volume dropped last session. Repeat ${last.topWeight} lb and match the reps before moving up.`,
  };
}

function countSets(data: AppData, exercise: string, date: string): number {
  const key = exercise.trim().toLowerCase();
  return data.workoutEntries
    .filter((w) => w.date === date && w.exercise.trim().toLowerCase() === key)
    .reduce((n, w) => n + w.sets, 0);
}

/**
 * Whether today looks like a day to push or to back off, from sleep and
 * resting heart rate against your own recent baseline — not against a
 * population average, which would say nothing about you.
 */
export function readiness(data: AppData, date = todayKey()): ReadinessCall {
  const health = data.health ?? {};
  const todayHealth = health[date];
  // The fortnight before today, which is what "normal for you" means here.
  const baselineDays = lastNDays(15).filter((d) => d !== date);

  const sleeps = baselineDays
    .map((d) => health[d]?.sleepMinutes)
    .filter((v): v is number => typeof v === "number");
  const hrs = baselineDays
    .map((d) => health[d]?.restingHeartRate)
    .filter((v): v is number => typeof v === "number");

  if (!todayHealth || (sleeps.length < 5 && hrs.length < 5)) {
    return {
      level: "unknown",
      headline: "Not enough data yet",
      reasons: [
        "Readiness compares today against your own last two weeks. Once the tracker has sent about a week of sleep and heart rate, this starts working.",
      ],
    };
  }

  const reasons: string[] = [];
  let score = 0;

  if (typeof todayHealth.sleepMinutes === "number" && sleeps.length >= 5) {
    const base = mean(sleeps);
    const diff = todayHealth.sleepMinutes - base;
    if (diff <= -45) {
      score -= 1;
      reasons.push(`Slept ${Math.round(-diff)} min less than your average.`);
    } else if (diff >= 30) {
      score += 1;
      reasons.push(`Slept ${Math.round(diff)} min more than your average.`);
    } else {
      reasons.push("Sleep was about normal for you.");
    }
  }

  if (typeof todayHealth.restingHeartRate === "number" && hrs.length >= 5) {
    const base = mean(hrs);
    const diff = todayHealth.restingHeartRate - base;
    if (diff >= 4) {
      score -= 1;
      reasons.push(
        `Resting heart rate is ${Math.round(diff)} bpm above your baseline — often a sign of fatigue or a bug coming on.`,
      );
    } else if (diff <= -2) {
      score += 1;
      reasons.push(`Resting heart rate is ${Math.round(-diff)} bpm below baseline.`);
    } else {
      reasons.push("Resting heart rate is where it usually sits.");
    }
  }

  if (score >= 1) {
    return { level: "push", headline: "Good day to push", reasons };
  }
  if (score <= -1) {
    return { level: "ease", headline: "Ease off today", reasons };
  }
  return { level: "normal", headline: "Normal training day", reasons };
}

/**
 * Observations about training and eating over the last few weeks. Each one
 * has to clear a threshold before it appears, so a quiet list means nothing
 * stood out rather than nothing was looked at.
 */
export function coachNotes(data: AppData): CoachNote[] {
  const out: CoachNote[] = [];
  const last28 = lastNDays(28);
  const prev28 = lastNDays(56).slice(0, 28);

  // --- Training frequency ------------------------------------------------
  const sessionDays = new Set(data.workoutEntries.map((w) => w.date));
  const nowCount = last28.filter((d) => sessionDays.has(d)).length;
  const prevCount = prev28.filter((d) => sessionDays.has(d)).length;

  if (nowCount > 0) {
    const perWeek = (nowCount / 4).toFixed(1);
    if (prevCount > 0 && nowCount - prevCount >= 3) {
      out.push({
        title: "Training more often",
        detail: `${perWeek} sessions a week this month, up from ${(prevCount / 4).toFixed(1)}.`,
        tone: "good",
      });
    } else if (prevCount > 0 && prevCount - nowCount >= 3) {
      out.push({
        title: "Training less often",
        detail: `${perWeek} sessions a week this month, down from ${(prevCount / 4).toFixed(1)}.`,
        tone: "watch",
      });
    } else {
      out.push({
        title: "Training frequency",
        detail: `${perWeek} sessions a week over the last month.`,
        tone: "neutral",
      });
    }
  }

  // --- Lifts that have stopped moving -------------------------------------
  const stalled = loggedExercises(data)
    .map((e) => suggestNext(data, e))
    .filter((s): s is Suggestion => Boolean(s?.stalled));

  if (stalled.length > 0) {
    out.push({
      title: stalled.length === 1 ? "One lift has stalled" : `${stalled.length} lifts have stalled`,
      detail: `${stalled
        .map((s) => `${s.exercise} (${s.sessionsAtWeight} sessions)`)
        .join(", ")} — the weight hasn't moved. Add a rep, or drop 10% and build back up.`,
      tone: "watch",
    });
  }

  // --- Protein, which is the macro people actually miss ---------------------
  const target = macroTargets(data);
  if (target) {
    const logged = lastNDays(14).filter((d) => dayTotals(data, d).calories > 0);
    if (logged.length >= 5) {
      const hit = logged.filter((d) => dayTotals(data, d).protein >= target.protein * 0.9);
      const rate = Math.round((hit.length / logged.length) * 100);
      out.push({
        title: rate >= 70 ? "Protein is on track" : "Protein is falling short",
        detail: `You hit your protein target on ${hit.length} of the last ${logged.length} logged days (${rate}%).`,
        tone: rate >= 70 ? "good" : "watch",
      });

      const avgCal = mean(logged.map((d) => dayTotals(data, d).calories));
      const goal = data.profile?.goal;
      const gap = avgCal - target.calories;
      if (goal === "cut" && gap > 200) {
        out.push({
          title: "Eating above your cut",
          detail: `Averaging ${Math.round(avgCal)} calories against a ${target.calories} target. A cut this size won't move the scale.`,
          tone: "watch",
        });
      } else if (goal === "bulk" && gap < -200) {
        out.push({
          title: "Eating below your bulk",
          detail: `Averaging ${Math.round(avgCal)} calories against a ${target.calories} target. Hard to add size on that.`,
          tone: "watch",
        });
      }
    }
  }

  // --- Body weight trend ----------------------------------------------------
  const weights = Object.entries(data.bodyWeight)
    .filter(([d]) => last28.includes(d))
    .sort(([a], [b]) => a.localeCompare(b));
  if (weights.length >= 4) {
    const firstHalf = weights.slice(0, Math.floor(weights.length / 2)).map(([, w]) => w);
    const secondHalf = weights.slice(Math.floor(weights.length / 2)).map(([, w]) => w);
    const change = mean(secondHalf) - mean(firstHalf);
    if (Math.abs(change) >= 1) {
      out.push({
        title: change > 0 ? "Body weight is climbing" : "Body weight is coming down",
        detail: `About ${Math.abs(change).toFixed(1)} lb over the last month.`,
        tone: "neutral",
      });
    }
  }

  return out;
}
