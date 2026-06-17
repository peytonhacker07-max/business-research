import type { AppData } from "./types";

const STORAGE_KEY = "daily.habit-tracker.v1";

const EMPTY: AppData = { habits: [], completions: {} };

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

  return { habits, completions };
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
