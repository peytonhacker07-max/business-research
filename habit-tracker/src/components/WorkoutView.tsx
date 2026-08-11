import { useEffect, useMemo, useState } from "react";
import type { AppApi } from "../lib/useAppData";
import { addDays, fromKey, formatLong, monthShort, toKey } from "../lib/dates";
import { ChevronDownIcon, PlusIcon } from "./Icons";

type SubView = "day" | "progress";

/** Hand-rolled SVG line chart for an arbitrary labeled value series. */
function SimpleLineChart({ series }: { series: { label: string; value: number }[] }) {
  const W = 320;
  const H = 120;
  const padL = 34;
  const padR = 8;
  const padT = 10;
  const padB = 20;

  if (series.length === 0) return null;

  const values = series.map((s) => s.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const x = (i: number) =>
    padL + (series.length <= 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - ((v - min) / range) * innerH;

  const points = series.map((s, i) => ({ x: x(i), y: y(s.value) }));
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const floorY = (padT + innerH).toFixed(1);
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${floorY} L${points[0].x.toFixed(1)},${floorY} Z`;

  const tickIdx = series.length === 1 ? [0] : [0, series.length - 1];

  return (
    <svg className="line-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Progress over time">
      {[min, (min + max) / 2, max].map((v, i) => (
        <g key={i}>
          <line className="grid-line" x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} />
          <text className="axis-label" x={padL - 4} y={y(v) + 3} textAnchor="end">
            {Math.round(v * 10) / 10}
          </text>
        </g>
      ))}
      <path className="area" d={areaPath} />
      <path className="line" d={linePath} />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 3.5 : 2.5} fill="var(--accent)" />
      ))}
      {tickIdx.map((i) => (
        <text
          key={i}
          className="axis-label"
          x={x(i)}
          y={H - 4}
          textAnchor={i === 0 ? "start" : "end"}
        >
          {series[i].label}
        </text>
      ))}
    </svg>
  );
}

/** Calendar-style day view: pick a date, log weight + exercises for it, page back through history. */
function DaySection({ api }: { api: AppApi }) {
  const { data, today } = api;
  const [selectedDate, setSelectedDate] = useState(today);
  const isToday = selectedDate === today;

  const goPrev = () => setSelectedDate(toKey(addDays(fromKey(selectedDate), -1)));
  const goNext = () => {
    if (isToday) return;
    setSelectedDate(toKey(addDays(fromKey(selectedDate), 1)));
  };

  const entries = data.workoutEntries
    .filter((w) => w.date === selectedDate)
    .sort((a, b) => a.order - b.order);

  const [exercise, setExercise] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");

  const handleAdd = () => {
    const name = exercise.trim();
    const s = parseInt(sets, 10);
    const r = parseInt(reps, 10);
    const w = parseFloat(weight);
    if (!name || !s || !r || !w) return;
    api.addWorkoutEntry(selectedDate, name, s, r, w);
    setExercise("");
    setSets("");
    setReps("");
    setWeight("");
  };

  const [weightInput, setWeightInput] = useState("");
  useEffect(() => {
    const w = data.bodyWeight[selectedDate];
    setWeightInput(w ? String(w) : "");
  }, [selectedDate, data.bodyWeight]);

  const handleSaveWeight = () => {
    const w = parseFloat(weightInput);
    if (!w) return;
    api.setBodyWeight(selectedDate, w);
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <button className="icon-btn" onClick={goPrev} style={{ width: 32, height: 32 }}>
          <span style={{ display: "flex", transform: "rotate(90deg)" }}>
            <ChevronDownIcon className="" />
          </span>
        </button>
        <div style={{ textAlign: "center" }}>
          {isToday && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--accent)",
                letterSpacing: "0.06em",
                marginBottom: 2,
              }}
            >
              TODAY
            </div>
          )}
          <div style={{ fontSize: 17, fontWeight: 700 }}>{formatLong(fromKey(selectedDate))}</div>
        </div>
        <button
          className="icon-btn"
          onClick={goNext}
          disabled={isToday}
          style={{ width: 32, height: 32 }}
        >
          <span style={{ display: "flex", transform: "rotate(-90deg)" }}>
            <ChevronDownIcon className="" />
          </span>
        </button>
      </div>

      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", margin: "0 0 10px" }}>
          BODY WEIGHT
        </p>
        <div className="workout-add-row" style={{ marginBottom: 0 }}>
          <input
            type="number"
            step="0.1"
            placeholder="Weight (lb)"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            style={{ flex: 3, textAlign: "left" }}
          />
          <button className="btn primary" style={{ flex: 1, padding: 0 }} onClick={handleSaveWeight}>
            Save
          </button>
        </div>
      </div>

      <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", margin: "0 0 10px" }}>
          WORKOUT
        </p>
        <input
          className="workout-name-input"
          type="text"
          placeholder="Exercise name"
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
        />
        <div className="workout-add-row">
          <input
            type="number"
            placeholder="Sets"
            value={sets}
            onChange={(e) => setSets(e.target.value)}
          />
          <input
            type="number"
            placeholder="Reps"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
          <input
            type="number"
            placeholder="Lb"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <button className="btn primary block" onClick={handleAdd} style={{ marginBottom: entries.length ? 14 : 0 }}>
          <PlusIcon className="" />
          Add Exercise
        </button>

        {entries.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-faint)", textAlign: "center", margin: 0 }}>
            Nothing logged {isToday ? "yet today" : "for this day"}.
          </p>
        ) : (
          entries.map((entry, i) => (
            <div
              key={entry.id}
              className="habit-row"
              style={{ marginBottom: i === entries.length - 1 ? 0 : 8 }}
            >
              <div className="habit-body">
                <div className="habit-name">{entry.exercise}</div>
                <div className="habit-streak mono">
                  {entry.sets} × {entry.reps} @ {entry.weight} lb
                </div>
              </div>
              <button className="icon-btn" onClick={() => api.deleteWorkoutEntry(entry.id)}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>×</span>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProgressSection({ api }: { api: AppApi }) {
  const { data } = api;
  const exercises = useMemo(() => {
    const names = new Set<string>();
    for (const w of data.workoutEntries) names.add(w.exercise);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [data.workoutEntries]);

  const [selected, setSelected] = useState<string>("");
  const activeExercise = exercises.includes(selected) ? selected : exercises[0] ?? "";

  if (exercises.length === 0) {
    return (
      <div className="empty">
        <h2>No progress yet</h2>
        <p>Log a few sessions in the Day tab and your chart will show up here.</p>
      </div>
    );
  }

  const entriesForExercise = data.workoutEntries
    .filter((w) => w.exercise === activeExercise)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const byDate = new Map<string, number>();
  for (const e of entriesForExercise) {
    byDate.set(e.date, Math.max(byDate.get(e.date) ?? 0, e.weight));
  }
  const series = Array.from(byDate.entries()).map(([date, value]) => {
    const d = fromKey(date);
    return { label: `${monthShort(d.getMonth())} ${d.getDate()}`, value };
  });

  const currentMax = series[series.length - 1]?.value ?? 0;
  const allTimePR = Math.max(...series.map((s) => s.value));

  return (
    <div>
      <select
        className="exercise-select"
        value={activeExercise}
        onChange={(e) => setSelected(e.target.value)}
      >
        {exercises.map((ex) => (
          <option key={ex} value={ex}>
            {ex}
          </option>
        ))}
      </select>

      <div className="chart-card">
        <h3>{activeExercise} — Max Weight</h3>
        <SimpleLineChart series={series} />
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <div className="stat-num mono">{currentMax} lb</div>
          <div className="stat-cap">Current max</div>
        </div>
        <div className="stat-box">
          <div className="stat-num mono">{allTimePR} lb</div>
          <div className="stat-cap">All-time PR</div>
        </div>
        <div className="stat-box">
          <div className="stat-num mono">{series.length}</div>
          <div className="stat-cap">Sessions logged</div>
        </div>
      </div>
    </div>
  );
}

export default function WorkoutView({ api }: { api: AppApi }) {
  const [sub, setSub] = useState<SubView>("day");

  return (
    <div className="view">
      <div className="range-tabs" role="tablist" aria-label="Workout section">
        {(["day", "progress"] as SubView[]).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={sub === s}
            className={sub === s ? "active" : ""}
            onClick={() => setSub(s)}
          >
            {s === "day" ? "Day" : "Progress"}
          </button>
        ))}
      </div>

      {sub === "day" && <DaySection api={api} />}
      {sub === "progress" && <ProgressSection api={api} />}
    </div>
  );
}
