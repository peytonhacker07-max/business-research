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

export interface AppData {
  habits: Habit[];
  /** Map of `${habitId}|${date}` -> Completion. Only `completed: true` entries kept. */
  completions: Record<string, Completion>;
  goals?: Goal[];
}

export type ViewName = "today" | "history" | "analytics";
