import { useEffect, useState } from "react";
import { cycleTheme, getStoredTheme, setStoredTheme, type ThemeChoice } from "../lib/theme";
import { AutoIcon, MoonIcon, SunIcon } from "./Icons";

const LABEL: Record<ThemeChoice, string> = {
  light: "Light theme",
  dark: "Dark theme",
  system: "Matching system theme",
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeChoice>(() => getStoredTheme());

  // Keep in sync if changed elsewhere (e.g. another tab).
  useEffect(() => {
    setStoredTheme(theme);
  }, [theme]);

  const handleClick = () => setTheme((t) => cycleTheme(t));

  return (
    <button
      className="icon-btn theme-toggle"
      onClick={handleClick}
      aria-label={`${LABEL[theme]} — tap to change`}
      title={LABEL[theme]}
    >
      {theme === "light" && <SunIcon className="" />}
      {theme === "dark" && <MoonIcon className="" />}
      {theme === "system" && <AutoIcon className="" />}
    </button>
  );
}
