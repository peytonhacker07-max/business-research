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

export interface AppData {
  habits: Habit[];
  /** Map of `${habitId}|${date}` -> Completion. Only `completed: true` entries kept. */
  completions: Record<string, Completion>;
}

export type ViewName = "today" | "history" | "analytics";
