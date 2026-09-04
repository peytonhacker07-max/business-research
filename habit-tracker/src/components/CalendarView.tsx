import { useMemo, useState } from "react";
import type { AppApi } from "../lib/useAppData";
import { fromKey, toKey, monthLong, formatLong } from "../lib/dates";
import { activeHabits, isDone, dayCompletionRate } from "../lib/streaks";
import { ChevronDownIcon } from "./Icons";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: "0.04em", margin: "0 0 8px" }}>
      {children}
    </p>
  );
}

export default function CalendarView({ api }: { api: AppApi }) {
  const { data, today } = api;
  const todayDate = fromKey(today);

  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);

  const isCurrentMonth = viewYear === todayDate.getFullYear() && viewMonth === todayDate.getMonth();

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    if (isCurrentMonth) return;
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const cells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startOffset = firstOfMonth.getDay();
    const out: { key: string | null; day: number | null }[] = [];
    for (let i = 0; i < startOffset; i++) out.push({ key: null, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ key: toKey(new Date(viewYear, viewMonth, d)), day: d });
    }
    return out;
  }, [viewYear, viewMonth]);

  const summaryFor = (dateKey: string) => {
    const rate = dateKey <= today ? dayCompletionRate(data, dateKey) : 0;
    const hasNote = Boolean(data.notes[dateKey]);
    const hasWorkout =
      data.workoutEntries.some((w) => w.date === dateKey) || data.bodyWeight[dateKey] !== undefined;
    return { rate, hasNote, hasWorkout };
  };

  const selectedHabits = useMemo(
    () => activeHabits(data).filter((h) => h.createdAt <= selectedDate),
    [data, selectedDate],
  );
  const selectedTodos = data.todos.filter((t) => t.createdAt === selectedDate);
  const selectedWorkouts = data.workoutEntries
    .filter((w) => w.date === selectedDate)
    .sort((a, b) => a.order - b.order);
  const selectedNote = data.notes[selectedDate];
  const selectedWeight = data.bodyWeight[selectedDate];
  const selectedFocus = data.workoutFocus[selectedDate];

  const nothingTracked =
    selectedHabits.length === 0 &&
    selectedTodos.length === 0 &&
    selectedWorkouts.length === 0 &&
    !selectedNote &&
    selectedWeight === undefined;

  return (
    <div className="view">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button className="icon-btn" onClick={goPrevMonth} style={{ width: 32, height: 32 }}>
          <span style={{ display: "flex", transform: "rotate(90deg)" }}>
            <ChevronDownIcon className="" />
          </span>
        </button>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700 }}>
          {monthLong(viewMonth)} {viewYear}
        </div>
        <button
          className="icon-btn"
          onClick={goNextMonth}
          disabled={isCurrentMonth}
          style={{ width: 32, height: 32 }}
        >
          <span style={{ display: "flex", transform: "rotate(-90deg)" }}>
            <ChevronDownIcon className="" />
          </span>
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5, marginBottom: 6 }}>
        {WEEKDAY_LETTERS.map((l, i) => (
          <div
            key={i}
            style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--ink-faint)", padding: "2px 0" }}
          >
            {l}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5, marginBottom: 18 }}>
        {cells.map((cell, i) => {
          if (!cell.key) return <div key={`blank-${i}`} />;
          const dateKey = cell.key;
          const { rate, hasNote, hasWorkout } = summaryFor(dateKey);
          const isToday = dateKey === today;
          const isSelected = dateKey === selectedDate;
          const isFuture = dateKey > today;
          const dotColor = isSelected ? "rgba(255,255,255,0.9)" : "var(--accent)";
          return (
            <button
              key={dateKey}
              onClick={() => setSelectedDate(dateKey)}
              style={{
                aspectRatio: "1",
                borderRadius: 12,
                border: "none",
                background: isSelected ? "var(--accent)" : "var(--paper)",
                boxShadow: isSelected
                  ? "inset 2px 2px 4px rgba(0,0,0,0.18)"
                  : isToday
                    ? "var(--shadow-inset-xs)"
                    : "var(--shadow-xs)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                padding: 0,
                opacity: isFuture ? 0.45 : 1,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: isToday ? 800 : 600,
                  color: isSelected ? "#fff" : "var(--ink)",
                }}
              >
                {cell.day}
              </span>
              <span style={{ display: "flex", gap: 2, height: 4 }}>
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: rate > 0 ? dotColor : "transparent",
                  }}
                />
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: hasNote ? dotColor : "transparent",
                  }}
                />
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: hasWorkout ? dotColor : "transparent",
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ borderRadius: 20, background: "var(--paper)", boxShadow: "var(--shadow-sm)", padding: 16 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
          {selectedDate === today ? "Today" : formatLong(fromKey(selectedDate))}
        </div>

        {nothingTracked ? (
          <p style={{ fontSize: 13, color: "var(--ink-faint)", margin: 0 }}>Nothing tracked this day.</p>
        ) : (
          <>
            {selectedHabits.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <SectionLabel>HABITS</SectionLabel>
                {selectedHabits.map((h) => {
                  const done = isDone(data, h.id, selectedDate);
                  return (
                    <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          flexShrink: 0,
                          background: done ? "var(--accent)" : "var(--paper)",
                          boxShadow: done ? "inset 1.5px 1.5px 3px rgba(0,0,0,0.18)" : "var(--shadow-inset-xs)",
                        }}
                      />
                      <span style={{ fontSize: 13, color: done ? "var(--ink)" : "var(--ink-faint)" }}>
                        {h.icon ? `${h.icon} ` : ""}
                        {h.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedTodos.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <SectionLabel>TASKS</SectionLabel>
                {selectedTodos.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 5,
                        flexShrink: 0,
                        background: t.done ? "var(--accent)" : "var(--paper)",
                        boxShadow: t.done ? "inset 1.5px 1.5px 3px rgba(0,0,0,0.18)" : "var(--shadow-inset-xs)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        color: t.done ? "var(--ink-faint)" : "var(--ink)",
                        textDecoration: t.done ? "line-through" : "none",
                      }}
                    >
                      {t.text}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {(selectedWorkouts.length > 0 || selectedWeight !== undefined || selectedFocus) && (
              <div style={{ marginBottom: 16 }}>
                <SectionLabel>WORKOUT</SectionLabel>
                {selectedFocus && (
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{selectedFocus}</div>
                )}
                {selectedWeight !== undefined && (
                  <div className="mono" style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}>
                    Body weight: {selectedWeight} lb
                  </div>
                )}
                {selectedWorkouts.map((w) => (
                  <div key={w.id} style={{ padding: "3px 0" }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{w.exercise}</span>
                    <span className="mono" style={{ fontSize: 12, color: "var(--ink-soft)", marginLeft: 8 }}>
                      {w.sets}
                      {w.reps ? ` × ${w.reps}` : " sets"}
                      {w.weight ? ` @ ${w.weight} lb` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {selectedNote && (
              <div>
                <SectionLabel>JOURNAL</SectionLabel>
                <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap" }}>
                  {selectedNote}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
