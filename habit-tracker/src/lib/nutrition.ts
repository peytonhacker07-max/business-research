import type { AppData, FoodEntry, MacroTargets, Profile } from "./types";
import { todayKey } from "./dates";

/**
 * Turning body weight into daily targets, and a day's food into totals.
 *
 * The numbers here are the standard sports-nutrition rules of thumb, not
 * anything clever: Mifflin-St Jeor for resting burn, a fixed multiplier for
 * activity, protein by body weight, fat as a share of calories, carbs as
 * whatever is left. They are a starting point to adjust from, which is how
 * every coach uses them too.
 */

const ACTIVITY_FACTOR: Record<NonNullable<Profile["activity"]>, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

/** Calorie offset from maintenance. A cut of 500/day is about a pound a week. */
const GOAL_OFFSET: Record<NonNullable<Profile["goal"]>, number> = {
  cut: -500,
  maintain: 0,
  bulk: 300,
};

export const MACRO_KEYS = ["calories", "protein", "carbs", "fat"] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];

/** The most recent body weight on or before `date`, in pounds. */
export function latestBodyWeight(data: AppData, date = todayKey()): number | undefined {
  const keys = Object.keys(data.bodyWeight)
    .filter((k) => k <= date)
    .sort();
  const last = keys[keys.length - 1];
  return last ? data.bodyWeight[last] : undefined;
}

/**
 * Daily targets, from the most specific information available:
 * explicit targets beat a full profile, which beats body weight alone.
 * Returns undefined only when there is nothing at all to go on.
 */
export function macroTargets(data: AppData, date = todayKey()): MacroTargets | undefined {
  if (data.macroTargets) return data.macroTargets;

  const lb = latestBodyWeight(data, date);
  if (lb === undefined || lb <= 0) return undefined;

  const p = data.profile ?? {};
  const kg = lb * 0.453592;
  let calories: number;

  if (p.heightInches && p.birthYear && p.sex) {
    const cm = p.heightInches * 2.54;
    const age = new Date().getFullYear() - p.birthYear;
    const bmr =
      10 * kg + 6.25 * cm - 5 * age + (p.sex === "male" ? 5 : -161);
    calories = bmr * ACTIVITY_FACTOR[p.activity ?? "moderate"];
  } else {
    // No height or age: 15 kcal per pound is the usual stand-in for an
    // active adult's maintenance, and lands within a few hundred of
    // Mifflin-St Jeor for most people.
    calories = lb * 15;
  }

  calories += GOAL_OFFSET[p.goal ?? "maintain"];

  // A gram of protein per pound of body weight — the figure most lifting
  // coaches land on, and comfortably above the minimum for keeping muscle
  // in a deficit. Fat at a quarter of calories leaves room for carbs to
  // fuel training.
  const protein = Math.round(lb);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return {
    calories: Math.round(calories),
    protein,
    fat,
    carbs: Math.max(0, carbs),
  };
}

/** Everything eaten on one day, in the order it was logged. */
export function foodFor(data: AppData, date: string): FoodEntry[] {
  return (data.foodEntries ?? [])
    .filter((f) => f.date === date)
    .sort((a, b) => a.order - b.order);
}

/** Totals for one day. Always returns all four keys, zeroed if nothing logged. */
export function dayTotals(data: AppData, date: string): MacroTargets {
  const out = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const f of foodFor(data, date)) {
    out.calories += f.calories;
    out.protein += f.protein;
    out.carbs += f.carbs;
    out.fat += f.fat;
  }
  return out;
}

/**
 * Foods logged before, most-used first, for one-tap re-logging. Keyed on the
 * name and the macros together: "chicken, 200 kcal" and "chicken, 350 kcal"
 * are different foods to anyone tracking, even though the name matches.
 */
export function recentFoods(data: AppData, limit = 12): FoodEntry[] {
  const entries = data.foodEntries ?? [];
  const seen = new Map<string, { entry: FoodEntry; count: number; last: string }>();

  for (const f of entries) {
    const key = `${f.name.trim().toLowerCase()}|${f.calories}|${f.protein}|${f.carbs}|${f.fat}`;
    const prev = seen.get(key);
    if (prev) {
      prev.count += 1;
      if (f.date > prev.last) prev.last = f.date;
    } else {
      seen.set(key, { entry: f, count: 1, last: f.date });
    }
  }

  return [...seen.values()]
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, limit)
    .map((v) => v.entry);
}

/**
 * Calories burned beyond food, when the tracker has reported them: resting
 * burn plus the day's active energy. Used to show net intake rather than
 * pretending a 15,000-step day and a day on the sofa are the same.
 */
export function energyOut(data: AppData, date: string): number | undefined {
  const active = data.health?.[date]?.activeEnergy;
  if (active === undefined) return undefined;
  const target = macroTargets(data, date);
  if (!target) return undefined;
  // The target already contains an activity multiplier, so adding the full
  // active burn on top would double-count it. Resting burn is the honest
  // floor to add active energy to: roughly 70% of a moderate TDEE.
  return Math.round(target.calories * 0.7 + active);
}
