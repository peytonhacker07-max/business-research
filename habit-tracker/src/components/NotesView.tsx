import { useState } from "react";
import type { AppApi } from "../lib/useAppData";
import { lastNDays, fromKey, formatLong } from "../lib/dates";

export default function NotesView({ api }: { api: AppApi }) {
  const { data, today } = api;
  const [editingDate, setEditingDate] = useState<string>(today);
  const editingNote = data.notes[editingDate] || "";

  const pastDates = lastNDays(30).filter((d) => d < today).reverse();

  return (
    <div className="view" style={{ display: "flex", flexDirection: "column", gap: 0, margin: 0, padding: "0 0 96px 0" }}>
      <div style={{ padding: "12px", borderBottom: "1px solid var(--line)", background: "var(--paper-2)", flexShrink: 0 }}>
        <p style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 8, margin: 0 }}>
          {editingDate === today ? "Today's Entry" : formatLong(fromKey(editingDate))}
        </p>
        <textarea
          value={editingNote}
          onChange={(e) => api.setNote(editingDate, e.target.value)}
          placeholder="Write your thoughts..."
          style={{
            width: "100%",
            height: 100,
            padding: "12px",
            border: "1px solid var(--line)",
            borderRadius: "8px",
            fontSize: "14px",
            fontFamily: "inherit",
            color: "var(--ink)",
            backgroundColor: "var(--paper)",
            resize: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "var(--ink)", marginTop: 0 }}>
          Today
        </h2>

        <div
          onClick={() => setEditingDate(today)}
          style={{
            background: editingDate === today ? "var(--accent-wash)" : "var(--paper-2)",
            border: editingDate === today ? "1px solid var(--accent)" : "1px solid var(--line)",
            borderRadius: "12px",
            padding: "10px",
            cursor: "pointer",
            transition: "all 150ms",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", marginBottom: 4 }}>
            {formatLong(new Date())}
          </div>
          <div
            style={{
              fontSize: 12,
              color: data.notes[today] ? "var(--ink)" : "var(--ink-faint)",
              lineHeight: 1.4,
              maxHeight: 50,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {data.notes[today] || "No entry yet."}
          </div>
        </div>

        {pastDates.length > 0 && (
          <>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "var(--ink)", marginTop: 12 }}>
              Past Entries
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {pastDates.slice(0, 10).map((date) => (
                <div
                  key={date}
                  onClick={() => setEditingDate(date)}
                  style={{
                    background: editingDate === date ? "var(--accent-wash)" : "var(--paper-2)",
                    border: editingDate === date ? "1px solid var(--accent)" : "1px solid var(--line)",
                    borderLeft: "3px solid var(--accent)",
                    borderRadius: "6px",
                    padding: "10px",
                    cursor: "pointer",
                    transition: "all 150ms",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", marginBottom: 3 }}>
                    {formatLong(fromKey(date))}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: data.notes[date] ? "var(--ink-soft)" : "var(--ink-faint)",
                      lineHeight: 1.3,
                      maxHeight: 40,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {data.notes[date] || "Empty"}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
