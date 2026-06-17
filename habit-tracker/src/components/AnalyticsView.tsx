import { useState } from "react";
import type { AppApi } from "../lib/useAppData";
import {
  activeHabits,
  completionPercentage,
  currentStreak,
  dayCompletionRate,
  longestStreak,
} from "../lib/streaks";
import { addDays, monthShort, toKey } from "../lib/dates";

type Range = 7 | 30 | 90;

/** Hand-rolled SVG line chart of daily completion rate (0..100%). */
function CompletionLineChart({ data, range }: { data: AppApi["data"]; range: Range }) {
  const W = 320;
  const H = 120;
  const padL = 26;
  const padR = 6;
  const padT = 8;
  const padB = 18;

  const points: { key: string; date: Date; value: number }[] = [];
  const today = new Date();
  for (let i = range - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = toKey(d);
    points.push({ key, date: d, value: dayCompletionRate(data, key) * 100 });
  }

  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const x = (i: number) =>
    padL + (points.length <= 1 ? 0 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / 100) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");
  const areaPath =
    `M${x(0).toFixed(1)},${y(0).toFixed(1)} ` +
    points.map((p, i) => `L${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ") +
    ` L${x(points.length - 1).toFixed(1)},${y(0).toFixed(1)} Z`;

  // X tick labels: first, middle, last — show month/day
  const tickIdx = [0, Math.floor(points.length / 2), points.length - 1];

  return (
    <svg
      className="line-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Completion rate over time"
    >
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line className="grid-line" x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} />
          <text className="axis-label" x={padL - 4} y={y(v) + 3} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      <path className="area" d={areaPath} />
      <path className="line" d={linePath} />
      {tickIdx.map((i) => (
        <text
          key={i}
          className="axis-label"
          x={x(i)}
          y={H - 4}
          textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
        >
          {`${monthShort(points[i].date.getMonth())} ${points[i].date.getDate()}`}
        </text>
      ))}
    </svg>
  );
}

export default function AnalyticsView({ api }: { api: AppApi }) {
  const { data } = api;
  const habits = activeHabits(data);
  const [range, setRange] = useState<Range>(30);

  if (habits.length === 0) {
    return (
      <div className="view">
        <h2 className="view-title">Analytics</h2>
        <div className="empty">
          <div className="mark">📈</div>
          <h2>No data yet</h2>
          <p>Your charts will appear once you start checking off habits.</p>
        </div>
      </div>
    );
  }

  // Summary stats over the selected range
  const avgRate = (() => {
    let sum = 0;
    for (let i = 0; i < range; i++) {
      sum += dayCompletionRate(data, toKey(addDays(new Date(), -i))) * 100;
    }
    return Math.round(sum / range);
  })();
  const bestStreak = habits.reduce((m, h) => Math.max(m, longestStreak(data, h.id)), 0);
  const activeStreaks = habits.filter((h) => currentStreak(data, h.id) > 0).length;

  const streaksSorted = [...habits]
    .map((h) => ({ habit: h, streak: currentStreak(data, h.id) }))
    .sort((a, b) => b.streak - a.streak);
  const maxStreak = Math.max(1, ...streaksSorted.map((s) => s.streak));

  return (
    <div className="view">
      <h2 className="view-title">Analytics</h2>

      <div className="range-tabs" role="tablist" aria-label="Time range">
        {([7, 30, 90] as Range[]).map((r) => (
          <button
            key={r}
            role="tab"
            aria-selected={range === r}
            className={range === r ? "active" : ""}
            onClick={() => setRange(r)}
          >
            {r}d
          </button>
        ))}
      </div>

      <div className="stat-grid">
        <div className="stat-box">
          <div className="stat-num mono">{avgRate}%</div>
          <div className="stat-cap">Avg completion ({range}d)</div>
        </div>
        <div className="stat-box">
          <div className="stat-num mono">{bestStreak}</div>
          <div className="stat-cap">Longest streak ever</div>
        </div>
        <div className="stat-box">
          <div className="stat-num mono">{activeStreaks}</div>
          <div className="stat-cap">Active streaks</div>
        </div>
        <div className="stat-box">
          <div className="stat-num mono">{habits.length}</div>
          <div className="stat-cap">Active habits</div>
        </div>
      </div>

      <div className="chart-card">
        <h3>Completion rate over time</h3>
        <CompletionLineChart data={data} range={range} />
      </div>

      <div className="chart-card">
        <h3>Per-habit completion ({range}d)</h3>
        {habits.map((h) => {
          const pct = completionPercentage(data, h.id, range);
          return (
            <div className="bar-row" key={h.id}>
              <span className="bar-label">
                {h.icon ? `${h.icon} ` : ""}
                {h.name}
              </span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="bar-pct mono">{pct}%</span>
            </div>
          );
        })}
      </div>

      <div className="chart-card streak-list">
        <h3>Current streaks</h3>
        {streaksSorted.map(({ habit, streak }) => (
          <div className="bar-row" key={habit.id}>
            <span className="bar-label">
              {habit.icon ? `${habit.icon} ` : ""}
              {habit.name}
            </span>
            <span className="bar-track">
              <span
                className="bar-fill"
                style={{ width: `${(streak / maxStreak) * 100}%` }}
              />
            </span>
            <span className="bar-pct mono">{streak}d</span>
          </div>
        ))}
      </div>
    </div>
  );
}
