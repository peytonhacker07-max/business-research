import type { AppData } from "./types";

const STORAGE_KEY = "daily.habit-tracker.v1";

const EMPTY: AppData = {
  habits: [],
  completions: {},
  todos: [],
  notes: {},
  workoutEntries: [],
  bodyWeight: {},
  workoutFocus: {},
};

/** Load app data from localStorage, tolerating missing or corrupted data. */
export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY);
    const parsed = JSON.parse(raw);
    return normalize(parsed);
  } catch {
    // Corrupted JSON or unavailable storage — start clean rather than crash.
    return structuredClone(EMPTY);
  }
}

/** Coerce arbitrary parsed data into a valid AppData shape. */
function normalize(data: unknown): AppData {
  if (!data || typeof data !== "object") return structuredClone(EMPTY);
  const d = data as Partial<AppData>;

  const habits = Array.isArray(d.habits)
    ? d.habits
        .filter((h) => h && typeof h.id === "string" && typeof h.name === "string")
        .map((h, i) => ({
          id: h.id,
          name: h.name,
          icon: typeof h.icon === "string" ? h.icon : "",
          createdAt: typeof h.createdAt === "string" ? h.createdAt : "",
          archived: Boolean(h.archived),
          order: typeof h.order === "number" ? h.order : i,
        }))
    : [];

  const completions: AppData["completions"] = {};
  if (d.completions && typeof d.completions === "object") {
    for (const [key, value] of Object.entries(d.completions)) {
      if (
        value &&
        typeof value === "object" &&
        typeof (value as any).habitId === "string" &&
        typeof (value as any).date === "string" &&
        (value as any).completed === true
      ) {
        completions[key] = {
          habitId: (value as any).habitId,
          date: (value as any).date,
          completed: true,
        };
      }
    }
  }

  const todos = Array.isArray(d.todos)
    ? d.todos
        .filter((t) => t && typeof t.id === "string" && typeof t.text === "string")
        .map((t, i) => ({
          id: t.id,
          text: t.text,
          done: Boolean(t.done),
          createdAt: typeof t.createdAt === "string" ? t.createdAt : "",
          order: typeof t.order === "number" ? t.order : i,
        }))
    : [];

  const notes: AppData["notes"] = {};
  if (d.notes && typeof d.notes === "object") {
    for (const [date, content] of Object.entries(d.notes)) {
      if (typeof content === "string") {
        notes[date] = content;
      }
    }
  }

  const workoutEntries = Array.isArray(d.workoutEntries)
    ? d.workoutEntries
        .filter(
          (w) =>
            w &&
            typeof w.id === "string" &&
            typeof w.date === "string" &&
            typeof w.exercise === "string",
        )
        .map((w, i) => ({
          id: w.id,
          date: w.date,
          exercise: w.exercise,
          sets: typeof w.sets === "number" ? w.sets : 0,
          reps: typeof w.reps === "number" ? w.reps : 0,
          weight: typeof w.weight === "number" ? w.weight : 0,
          order: typeof w.order === "number" ? w.order : i,
          note: typeof w.note === "string" ? w.note : "",
        }))
    : [];

  const bodyWeight: AppData["bodyWeight"] = {};
  if (d.bodyWeight && typeof d.bodyWeight === "object") {
    for (const [date, w] of Object.entries(d.bodyWeight)) {
      if (typeof w === "number") {
        bodyWeight[date] = w;
      }
    }
  }

  const workoutFocus: AppData["workoutFocus"] = {};
  if (d.workoutFocus && typeof d.workoutFocus === "object") {
    for (const [date, text] of Object.entries(d.workoutFocus)) {
      if (typeof text === "string") {
        workoutFocus[date] = text;
      }
    }
  }

  return { habits, completions, todos, notes, workoutEntries, bodyWeight, workoutFocus };
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Debounced write to localStorage so rapid taps don't thrash storage. */
export function saveData(data: AppData): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage full or unavailable — nothing actionable; fail silently.
    }
  }, 300);
}

export function completionKey(habitId: string, date: string): string {
  return `${habitId}|${date}`;
}
