// Theme handling: light / dark / system, persisted to localStorage.
// index.html has a tiny inline script that applies the saved choice before
// paint (reading the same key) so there's no flash of the wrong theme.

export type ThemeChoice = "light" | "dark" | "system";

export type ColorScheme = "teal" | "blue" | "pink" | "black" | "purple" | "orange" | "red";

export const COLOR_SCHEMES: Record<ColorScheme, { name: string; primary: string; dark: string }> = {
  teal: { name: "Teal & Black", primary: "#1f5e54", dark: "#0d2820" },
  blue: { name: "Blue & Black", primary: "#1e4d8b", dark: "#0a2540" },
  pink: { name: "Pink & White", primary: "#d946a6", dark: "#6b1b47" },
  black: { name: "All Black", primary: "#1a1a1a", dark: "#0a0a0a" },
  purple: { name: "Purple & Black", primary: "#7c3aed", dark: "#3f1f6f" },
  orange: { name: "Orange & Black", primary: "#ea580c", dark: "#5a2506" },
  red: { name: "Red & Black", primary: "#dc2626", dark: "#6b1616" },
};

export const COLOR_SCHEME_KEYS = Object.keys(COLOR_SCHEMES) as ColorScheme[];

const STORAGE_KEY = "daily.theme";
const COLOR_SCHEME_KEY = "daily.color-scheme";

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

export function getStoredColorScheme(): ColorScheme {
  try {
    const raw = localStorage.getItem(COLOR_SCHEME_KEY);
    return raw && COLOR_SCHEME_KEYS.includes(raw as ColorScheme) ? (raw as ColorScheme) : "teal";
  } catch {
    return "teal";
  }
}

export function applyColorScheme(scheme: ColorScheme): void {
  const root = document.documentElement;
  const colors = COLOR_SCHEMES[scheme];
  root.style.setProperty("--color-primary", colors.primary);
  root.style.setProperty("--color-primary-dark", colors.dark);
}

export function setStoredColorScheme(scheme: ColorScheme): void {
  try {
    localStorage.setItem(COLOR_SCHEME_KEY, scheme);
  } catch {
    /* storage unavailable */
  }
  applyColorScheme(scheme);
}
