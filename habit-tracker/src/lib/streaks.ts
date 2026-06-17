import type { AppData, Habit } from "./types";
import { completionKey } from "./storage";
import { addDays, toKey, todayKey } from "./dates";

export function isDone(data: AppData, habitId: string, date: string): boolean {
  return Boolean(data.completions[completionKey(habitId, date)]);
}

/**
 * Current streak: consecutive completed days ending today, or ending
 * yesterday if today isn't done yet (so the streak isn't shown as broken
 * until a full day has actually been missed).
 */
export function currentStreak(data: AppData, habitId: string): number {
  const today = new Date();
  let cursor = today;
  if (!isDone(data, habitId, toKey(cursor))) {
    cursor = addDays(cursor, -1); // grace period for the current day
  }
  let streak = 0;
  while (isDone(data, habitId, toKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest run of consecutive completed days, ever. */
export function longestStreak(data: AppData, habitId: string): number {
  const dates = Object.values(data.completions)
    .filter((c) => c.habitId === habitId)
    .map((c) => c.date)
    .sort();
  if (dates.length === 0) return 0;

  let best = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const cur = new Date(dates[i]);
    const diff = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    run = diff === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

export function activeHabits(data: AppData): Habit[] {
  return data.habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order);
}

/** Completion rate (0..1) across active habits for a given day. */
export function dayCompletionRate(data: AppData, date: string): number {
  // Only count habits that existed on that date.
  const relevant = data.habits.filter((h) => !h.archived && h.createdAt <= date);
  if (relevant.length === 0) return 0;
  const done = relevant.filter((h) => isDone(data, h.id, date)).length;
  return done / relevant.length;
}

/** How many of today's active habits are completed. */
export function todayProgress(data: AppData): { done: number; total: number } {
  const habits = activeHabits(data);
  const today = todayKey();
  const done = habits.filter((h) => isDone(data, h.id, today)).length;
  return { done, total: habits.length };
}

/** Per-habit completion percentage over a window of the last `days` days. */
export function completionPercentage(
  data: AppData,
  habitId: string,
  days: number,
): number {
  const habit = data.habits.find((h) => h.id === habitId);
  if (!habit) return 0;
  const today = new Date();
  let counted = 0;
  let done = 0;
  for (let i = 0; i < days; i++) {
    const key = toKey(addDays(today, -i));
    if (key < habit.createdAt) break; // didn't exist yet
    counted++;
    if (isDone(data, habitId, key)) done++;
  }
  return counted === 0 ? 0 : Math.round((done / counted) * 100);
}
