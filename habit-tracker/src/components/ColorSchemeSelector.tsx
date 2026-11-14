import { useState } from "react";
import { COLOR_SCHEMES, COLOR_SCHEME_KEYS, type ColorScheme, getStoredColorScheme, setStoredColorScheme } from "../lib/theme";

export default function ColorSchemeSelector() {
  const [scheme, setScheme] = useState<ColorScheme>(() => getStoredColorScheme());
  const [open, setOpen] = useState(false);

  const handleSelect = (newScheme: ColorScheme) => {
    setScheme(newScheme);
    setStoredColorScheme(newScheme);
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        className="icon-btn"
        onClick={() => setOpen(!open)}
        title="Change color scheme"
        style={{
          background: `linear-gradient(135deg, ${COLOR_SCHEMES[scheme].primary} 50%, ${COLOR_SCHEMES[scheme].dark} 50%)`,
          borderRadius: "50%",
          width: 24,
          height: 24,
        }}
        aria-label={`Color scheme: ${COLOR_SCHEMES[scheme].name}`}
      />
      {open && (
        /* Themed from tokens rather than hardcoded white — the old menu was
           white-on-white text once the app was in dark mode. */
        <div className="scheme-menu" role="menu">
          {COLOR_SCHEME_KEYS.map((s) => (
            <button
              key={s}
              role="menuitemradio"
              aria-checked={scheme === s}
              className={"scheme-option" + (scheme === s ? " selected" : "")}
              onClick={() => handleSelect(s)}
            >
              <span
                className="scheme-swatch"
                style={{
                  background: `linear-gradient(135deg, ${COLOR_SCHEMES[s].primary} 50%, ${COLOR_SCHEMES[s].dark} 50%)`,
                }}
              />
              {COLOR_SCHEMES[s].name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
