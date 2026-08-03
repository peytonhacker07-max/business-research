import { useState } from "react";
import type { AppApi } from "../lib/useAppData";
import { addDays, formatLong, toKey, fromKey } from "../lib/dates";
import { ChevronUpIcon, ChevronDownIcon } from "./Icons";

export default function NotesView({ api }: { api: AppApi }) {
  const { data, today } = api;
  const [viewDate, setViewDate] = useState<string>(today);
  const note = data.notes[viewDate] || "";

  const viewDateObj = fromKey(viewDate);
  const todayObj = fromKey(today);

  const handlePrevDay = () => {
    const prev = addDays(fromKey(viewDate), -1);
    setViewDate(toKey(prev));
  };

  const handleNextDay = () => {
    const next = addDays(fromKey(viewDate), 1);
    setViewDate(toKey(next));
  };

  const isToday = viewDate === today;
  const isFuture = viewDateObj > todayObj;

  return (
    <div className="view">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button
          onClick={handlePrevDay}
          style={{
            background: "none",
            border: "none",
            color: "var(--ink)",
            cursor: "pointer",
            padding: "8px",
            display: "grid",
            placeItems: "center",
            transform: "rotate(90deg)",
          }}
        >
          <ChevronDownIcon className="" />
        </button>

        <div style={{ textAlign: "center", flex: 1 }}>
          <p className="view-title" style={{ marginTop: 0, marginBottom: 4 }}>
            {formatLong(viewDateObj)}
          </p>
          {!isToday && <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: 0 }}>
            {isFuture ? "Future" : "Past"}
          </p>}
        </div>

        <button
          onClick={handleNextDay}
          disabled={isFuture}
          style={{
            background: "none",
            border: "none",
            color: isFuture ? "var(--ink-faint)" : "var(--ink)",
            cursor: isFuture ? "default" : "pointer",
            padding: "8px",
            display: "grid",
            placeItems: "center",
            opacity: isFuture ? 0.5 : 1,
            transform: "rotate(-90deg)",
          }}
        >
          <ChevronUpIcon className="" />
        </button>
      </div>

      <textarea
        value={note}
        onChange={(e) => api.setNote(viewDate, e.target.value)}
        placeholder={isToday ? "Write your thoughts for today..." : "View notes from this day..."}
        className="note-textarea"
        disabled={isFuture}
        style={{
          width: "100%",
          height: "calc(100vh - 280px)",
          padding: "12px",
          border: `1px solid var(--line)`,
          borderRadius: "var(--radius)",
          fontSize: "15px",
          fontFamily: "inherit",
          color: "var(--ink)",
          backgroundColor: "var(--paper)",
          resize: "none",
          boxSizing: "border-box",
          opacity: isFuture ? 0.6 : 1,
          cursor: isFuture ? "not-allowed" : "text",
        }}
      />
    </div>
  );
}
