export interface Habit {
  id: string;
  name: string;
  icon: string; // emoji or single char; may be empty
  createdAt: string; // YYYY-MM-DD
  archived: boolean;
  order: number; // for manual reordering
}

/** One record per habit per day it was completed. Keyed by `${habitId}|${date}`. */
export interface Completion {
  habitId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
}

/**
 * A one-off goal for a specific day. Unlike habits (which repeat daily and
 * build streaks), goals belong to a single date and are done or not.
 */
export interface Goal {
  id: string;
  text: string;
  date: string; // YYYY-MM-DD the goal is for
  done: boolean;
  order: number;
}

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  createdAt: string; // YYYY-MM-DD
  order: number;
}

/** One logged set-group for an exercise on a given day. */
export interface WorkoutEntry {
  id: string;
  date: string; // YYYY-MM-DD
  exercise: string;
  sets: number;
  reps: number;
  weight: number; // lb
  order: number;
  note: string; // optional detail, e.g. "went to failure", "partial reps"
}

export interface AppData {
  habits: Habit[];
  /** Map of `${habitId}|${date}` -> Completion. Only `completed: true` entries kept. */
  completions: Record<string, Completion>;
  goals?: Goal[];
  todos: Todo[];
  /** Map of date (YYYY-MM-DD) -> note content. */
  notes: Record<string, string>;
  workoutEntries: WorkoutEntry[];
  /** Map of date (YYYY-MM-DD) -> body weight in lb. */
  bodyWeight: Record<string, number>;
  /** Map of date (YYYY-MM-DD) -> what the workout focused on, e.g. "Chest & Back". */
  workoutFocus: Record<string, string>;
}

export type ViewName = "today" | "analytics" | "todos" | "notes" | "workout";
