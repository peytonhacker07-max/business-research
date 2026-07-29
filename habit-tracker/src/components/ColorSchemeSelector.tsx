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
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 8,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 6,
            padding: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 1000,
            minWidth: 160,
          }}
        >
          {COLOR_SCHEME_KEYS.map((s) => (
            <button
              key={s}
              onClick={() => handleSelect(s)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "8px 10px",
                border: "none",
                background: scheme === s ? "#f0f0f0" : "transparent",
                cursor: "pointer",
                fontSize: 13,
                textAlign: "left",
                borderRadius: 4,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${COLOR_SCHEMES[s].primary} 50%, ${COLOR_SCHEMES[s].dark} 50%)`,
                  flexShrink: 0,
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
