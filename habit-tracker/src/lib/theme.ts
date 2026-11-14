// Theme handling: light / dark / system, persisted to localStorage.
// index.html has a tiny inline script that applies the saved choice before
// paint (reading the same key) so there's no flash of the wrong theme.

export type ThemeChoice = "light" | "dark" | "system";

export type ColorScheme = "teal" | "blue" | "pink" | "black" | "purple" | "orange" | "red";

/**
 * The swatch colours shown in the picker. The accent the app actually uses
 * lives in CSS, keyed off `data-scheme` — see the "Accent schemes" block in
 * index.css — because each scheme needs a different value on a light ground
 * than on a dark one, and CSS can switch between them without re-running
 * anything. These two values are the swatch only.
 */
export const COLOR_SCHEMES: Record<ColorScheme, { name: string; primary: string; dark: string }> = {
  teal: { name: "Teal", primary: "#0d7d6c", dark: "#2dd4bf" },
  blue: { name: "Blue", primary: "#2563eb", dark: "#60a5fa" },
  pink: { name: "Pink", primary: "#db2777", dark: "#f472b6" },
  black: { name: "Monochrome", primary: "#1a1a1a", dark: "#e9edf2" },
  purple: { name: "Purple", primary: "#6d4aff", dark: "#a78bfa" },
  orange: { name: "Orange", primary: "#ea580c", dark: "#fb923c" },
  red: { name: "Red", primary: "#dc2626", dark: "#f87171" },
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
    return raw && COLOR_SCHEME_KEYS.includes(raw as ColorScheme) ? (raw as ColorScheme) : "purple";
  } catch {
    return "purple";
  }
}

export function applyColorScheme(scheme: ColorScheme): void {
  // An attribute, not an inline style: the stylesheet then picks the right
  // shade for whichever theme is active. Inline styles would pin one shade
  // and follow you into dark mode, where several of them vanish.
  document.documentElement.setAttribute("data-scheme", scheme);
}

export function setStoredColorScheme(scheme: ColorScheme): void {
  try {
    localStorage.setItem(COLOR_SCHEME_KEY, scheme);
  } catch {
    /* storage unavailable */
  }
  applyColorScheme(scheme);
}
