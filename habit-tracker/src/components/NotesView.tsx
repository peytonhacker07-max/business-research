import type { AppApi } from "../lib/useAppData";
import { formatLong } from "../lib/dates";

export default function NotesView({ api }: { api: AppApi }) {
  const { data, today } = api;
  const note = data.notes[today] || "";

  return (
    <div className="view">
      <p className="view-title" style={{ textAlign: "center", marginTop: 0 }}>
        {formatLong(new Date())}
      </p>

      <textarea
        value={note}
        onChange={(e) => api.setNote(today, e.target.value)}
        placeholder="Write your thoughts for today..."
        className="note-textarea"
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
        }}
      />
    </div>
  );
}
