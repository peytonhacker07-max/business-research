import type { AppApi } from "../lib/useAppData";
import {
  activeHabits,
  completionPercentage,
  dayCompletionRate,
  isDone,
} from "../lib/streaks";
import { addDays, toKey, todayKey } from "../lib/dates";

const WEEKS = 13; // ~3 months

const LEVEL_COLORS = ["#cde0d9", "#9cc3b8", "#5f9b8c", "#1f5e54"];

/** Build the aligned grid of day-cells ending today, starting on a Sunday. */
function buildCells(): { key: string; future: boolean }[] {
  const today = new Date();
  const totalDays = WEEKS * 7;
  let start = addDays(today, -(totalDays - 1));
  start = addDays(start, -start.getDay()); // back up to Sunday

  const cells: { key: string; future: boolean }[] = [];
  const todayK = todayKey();
  let cursor = start;
  // continue until we've passed today and reached the end of its week (Saturday)
  while (cursor <= today || cursor.getDay() !== 0) {
    const key = toKey(cursor);
    cells.push({ key, future: key > todayK });
    cursor = addDays(cursor, 1);
    if (cells.length > totalDays + 14) break; // safety
  }
  return cells;
}

interface CellGridProps {
  cells: { key: string; future: boolean }[];
  level: (key: string) => number; // 0 = none, 1..4 = intensity
}

function CellGrid({ cells, level }: CellGridProps) {
  return (
    <div className="heatmap-grid">
      {cells.map(({ key, future }) => {
        if (future) {
          return <div key={key} className="heat-cell lvl-future" />;
        }
        const lvl = level(key);
        const bg = lvl === 0 ? undefined : LEVEL_COLORS[lvl - 1];
        return (
          <div
            key={key}
            className="heat-cell"
            style={bg ? { background: bg, borderColor: "transparent" } : undefined}
            title={key}
          />
        );
      })}
    </div>
  );
}

export default function HistoryView({ api }: { api: AppApi }) {
  const { data } = api;
  const habits = activeHabits(data);
  const cells = buildCells();

  if (habits.length === 0) {
    return (
      <div className="view">
        <h2 className="view-title">History</h2>
        <div className="empty">
          <div className="mark">📅</div>
          <h2>Nothing to show yet</h2>
          <p>Add a habit and check in for a few days to see your history fill in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <h2 className="view-title">Last 3 months</h2>

      {/* Overall completion-rate heatmap */}
      <div className="heatmap-card">
        <div className="heatmap-head">
          <span className="title">Overall</span>
          <span className="pct">daily completion rate</span>
        </div>
        <CellGrid
          cells={cells}
          level={(key) => {
            const rate = dayCompletionRate(data, key);
            if (rate <= 0) return 0;
            if (rate < 0.34) return 1;
            if (rate < 0.67) return 2;
            if (rate < 1) return 3;
            return 4;
          }}
        />
        <div className="heat-legend">
          <span>less</span>
          <div className="heat-cell" />
          {LEVEL_COLORS.map((c) => (
            <div
              key={c}
              className="heat-cell"
              style={{ background: c, borderColor: "transparent" }}
            />
          ))}
          <span>more</span>
        </div>
      </div>

      {/* Per-habit heatmaps (binary) */}
      {habits.map((habit) => (
        <div className="heatmap-card" key={habit.id}>
          <div className="heatmap-head">
            <span className="title">
              {habit.icon && <span>{habit.icon}</span>}
              {habit.name}
            </span>
            <span className="pct mono">{completionPercentage(data, habit.id, 90)}%</span>
          </div>
          <CellGrid
            cells={cells}
            level={(key) => (isDone(data, habit.id, key) ? 4 : 0)}
          />
        </div>
      ))}
    </div>
  );
}
