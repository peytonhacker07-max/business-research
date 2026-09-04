import { useMemo } from "react";
import {
  useAssignments,
  formatAssignmentTime,
  formatCourseName,
  type Assignment,
} from "../lib/assignments";
import { useStudyPlan } from "../lib/studyPlan";
import { fromKey, formatLong, dayDiff, todayKey } from "../lib/dates";

function dueLabel(due: string, today: string): string {
  const diff = dayDiff(due, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return formatLong(fromKey(due));
}

export default function TaskView() {
  const today = todayKey();
  const assignments = useAssignments();
  const plan = useStudyPlan();

  const planDays = useMemo(
    () => (plan?.days ?? []).filter((d) => d.date >= today),
    [plan, today],
  );

  const upcoming = useMemo(
    () =>
      assignments
        .filter((a) => a.due >= today)
        .sort((a, b) =>
          a.due === b.due ? (a.time ?? "").localeCompare(b.time ?? "") : a.due < b.due ? -1 : 1,
        ),
    [assignments, today],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of upcoming) {
      const key = a.course ?? "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return [...map.entries()];
  }, [upcoming]);

  const hasCourses = groups.some(([course]) => course !== "Other");

  if (upcoming.length === 0) {
    return (
      <div className="view">
        <div className="empty">
          <h2>No assignments due</h2>
          <p>Synced weekly from Brightspace — check back after the next sync.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      {planDays.length > 0 && (
        <div
          style={{
            borderRadius: 20,
            background: "var(--paper)",
            boxShadow: "var(--shadow-sm)",
            padding: 16,
            marginBottom: 14,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--ink-soft)",
              letterSpacing: "0.04em",
              margin: "0 0 12px",
            }}
          >
            THIS WEEK'S PLAN
          </p>
          {planDays.map((day, i) => (
            <div
              key={day.date}
              style={{
                padding: "10px 0",
                borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 10,
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  {day.date === today ? "Today" : formatLong(fromKey(day.date))}
                </span>
                {day.focus && (
                  <span style={{ fontSize: 11, color: "var(--ink-soft)", textAlign: "right" }}>
                    {day.focus}
                  </span>
                )}
              </div>
              {day.tasks.map((task, j) => (
                <div
                  key={j}
                  style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "2px 0" }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      flexShrink: 0,
                      transform: "translateY(-2px)",
                    }}
                  />
                  <span style={{ fontSize: 13, lineHeight: 1.4 }}>{task}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {groups.map(([course, items]) => (
        <div
          key={course}
          style={{
            borderRadius: 20,
            background: "var(--paper)",
            boxShadow: "var(--shadow-sm)",
            padding: 16,
            marginBottom: 14,
          }}
        >
          {hasCourses && (
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 15,
                fontWeight: 700,
                margin: "0 0 10px",
              }}
            >
              {formatCourseName(course)}
            </p>
          )}
          {items.map((a, i) => {
            const diff = dayDiff(a.due, today);
            const time = formatAssignmentTime(a.time);
            return (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 0",
                  borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>{a.title}</span>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textAlign: "right",
                    flexShrink: 0,
                    lineHeight: 1.4,
                    color: diff <= 1 ? "var(--danger)" : "var(--ink-soft)",
                  }}
                >
                  {dueLabel(a.due, today)}
                  {time && (
                    <>
                      <br />
                      {time}
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
