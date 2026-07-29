// Theme handling: light / dark / system, persisted to localStorage.
// index.html has a tiny inline script that applies the saved choice before
// paint (reading the same key) so there's no flash of the wrong theme.

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "daily.theme";

export function getStoredTheme(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "light" || raw === "dark" ? raw : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

export function setStoredTheme(choice: ThemeChoice): void {
  try {
    if (choice === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* storage unavailable — theme just won't persist across sessions */
  }
  applyTheme(choice);
}

/** light -> dark -> system -> light ... */
export function cycleTheme(current: ThemeChoice): ThemeChoice {
  if (current === "light") return "dark";
  if (current === "dark") return "system";
  return "light";
}
