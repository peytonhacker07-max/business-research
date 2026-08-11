import { useState } from "react";
import type { AppApi } from "../lib/useAppData";
import { lastNDays, fromKey, formatLong } from "../lib/dates";

export default function NotesView({ api }: { api: AppApi }) {
  const { data, today } = api;
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const selectedNote = data.notes[selectedDate] || "";
  const pastDates = lastNDays(30).filter((d) => d < today).reverse();

  return (
    <div className="view" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Title and date display */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 6px 0", fontWeight: 600 }}>
          {selectedDate === today ? "TODAY" : formatLong(fromKey(selectedDate)).toUpperCase()}
        </p>
      </div>

      {/* Textarea editor */}
      <textarea
        value={selectedNote}
        onChange={(e) => api.setNote(selectedDate, e.target.value)}
        placeholder="Write your journal entry here..."
        style={{
          width: "100%",
          height: 140,
          padding: "12px",
          border: "1px solid var(--line)",
          borderRadius: "8px",
          fontSize: "14px",
          fontFamily: "inherit",
          color: "var(--ink)",
          backgroundColor: "var(--paper)",
          resize: "none",
          boxSizing: "border-box",
          marginBottom: 16,
        }}
      />

      {/* Past entries list */}
      {pastDates.length > 0 && (
        <div>
          <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "0 0 8px 0", fontWeight: 600 }}>
            PAST ENTRIES
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pastDates.slice(0, 14).map((date) => (
              <div
                key={date}
                onClick={() => setSelectedDate(date)}
                style={{
                  padding: "10px 12px",
                  background: selectedDate === date ? "var(--accent-wash)" : "var(--paper-2)",
                  border: selectedDate === date ? "1px solid var(--accent)" : "1px solid var(--line)",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "all 150ms",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", marginBottom: 3 }}>
                  {formatLong(fromKey(date))}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: data.notes[date] ? "var(--ink-soft)" : "var(--ink-faint)",
                    lineHeight: 1.3,
                    maxHeight: 32,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {data.notes[date] || "(empty)"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
