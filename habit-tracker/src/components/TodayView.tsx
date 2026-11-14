import { useState } from "react";
import type { AppApi } from "../lib/useAppData";
import { activeHabits, currentStreak, isDone, todayProgress } from "../lib/streaks";
import { formatLong } from "../lib/dates";
import { useDailyQuote } from "../lib/quotes";
import { dayTotals, macroTargets } from "../lib/nutrition";
import ProgressRing from "./ProgressRing";
import HabitFormModal from "./HabitFormModal";
import { CheckIcon, PencilIcon, PlusIcon } from "./Icons";
import type { Habit } from "../lib/types";

export default function TodayView({
  api,
  onGoToFood,
}: {
  api: AppApi;
  onGoToFood: () => void;
}) {
  const { data, today } = api;

  const fuelTarget = macroTargets(data, today);
  const fuelTotals = dayTotals(data, today);
  const habits = activeHabits(data);
  const { done, total } = todayProgress(data);

  // The longest run going right now, and how many habits are still alive.
  // Both are things you'd otherwise have to open Analytics to learn.
  const streaks = habits.map((h) => currentStreak(data, h.id));
  const best = streaks.length > 0 ? Math.max(...streaks) : 0;
  const alive = streaks.filter((s) => s > 0).length;

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);

  const quote = useDailyQuote(today);

  const [editingPinned, setEditingPinned] = useState(false);
  const [pinnedDraft, setPinnedDraft] = useState("");

  const openPinnedEditor = () => {
    setPinnedDraft(data.pinned ?? "");
    setEditingPinned(true);
  };
  const savePinned = () => {
    api.setPinned(pinnedDraft);
    setEditingPinned(false);
  };

  return (
    <div className="view">
      {editingPinned ? (
        <div className="pinned pinned-editing">
          <textarea
            className="pinned-input"
            autoFocus
            rows={3}
            value={pinnedDraft}
            placeholder="A goal, a verse, a quote — whatever you want to see first."
            onChange={(e) => setPinnedDraft(e.target.value)}
          />
          <div className="pinned-actions">
            <button className="btn ghost" onClick={() => setEditingPinned(false)}>
              Cancel
            </button>
            <button className="btn primary" onClick={savePinned}>
              Save
            </button>
          </div>
        </div>
      ) : data.pinned ? (
        <button className="pinned" onClick={openPinnedEditor} aria-label="Edit pinned note">
          <p className="pinned-text">{data.pinned}</p>
        </button>
      ) : (
        <button className="pinned pinned-empty" onClick={openPinnedEditor}>
          <span>+ Pin something to see each morning</span>
        </button>
      )}

      <ProgressRing
        done={done}
        total={total}
        caption={formatLong(new Date())}
        stats={
          total === 0
            ? []
            : [
                { label: "Best streak", value: best === 0 ? "—" : `${best}d` },
                { label: "Streaks alive", value: `${alive}/${total}` },
              ]
        }
      />

      {habits.length === 0 ? (
        <div className="empty">
          <h2>Start your first habit</h2>
          <p>Pick one small thing to do every day.</p>
          <button className="btn primary" onClick={() => setAdding(true)}>
            <PlusIcon className="" /> Add a habit
          </button>
        </div>
      ) : (
        <>
          <ul className="habit-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {habits.map((habit) => {
              const doneToday = isDone(data, habit.id, today);
              const streak = currentStreak(data, habit.id);
              return (
                <li key={habit.id}>
                  <div className={"habit-row" + (doneToday ? " done" : "")}>
                    <button
                      className="habit-check"
                      aria-pressed={doneToday}
                      aria-label={
                        (doneToday ? "Mark not done: " : "Mark done: ") + habit.name
                      }
                      onClick={() => api.toggleCompletion(habit.id, today)}
                    >
                      {doneToday && <CheckIcon className="" />}
                    </button>

                    {habit.icon && <span className="habit-emoji">{habit.icon}</span>}

                    <button
                      className="habit-body"
                      style={{ background: "none", border: "none", padding: 0 }}
                      onClick={() => api.toggleCompletion(habit.id, today)}
                      aria-hidden="true"
                      tabIndex={-1}
                    >
                      <div className="habit-name">{habit.name}</div>
                      <div className="habit-streak">
                        {streak > 0 ? (
                          <>
                            <span className="num mono">{streak}</span> day
                            {streak === 1 ? "" : "s"} streak
                          </>
                        ) : (
                          "no active streak"
                        )}
                      </div>
                    </button>

                    <div className="row-tools">
                      <button
                        className="icon-btn"
                        aria-label={`Edit ${habit.name}`}
                        onClick={() => setEditing(habit)}
                      >
                        <PencilIcon className="" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <button
            className="btn block add-habit-btn"
            onClick={() => setAdding(true)}
          >
            <PlusIcon className="" /> Add a habit
          </button>
        </>
      )}

      {/* Food lives under Fitness, but you log it several times a day, so it
          gets a line here too rather than two taps away. Only once there are
          targets to count against — an empty bar teaches nothing. */}
      {fuelTarget && (
        <button className="fuel-card" onClick={onGoToFood}>
          <div>
            <p className="fuel-label">Fuel today</p>
            <p className="fuel-sub">
              {fuelTotals.calories === 0
                ? "Nothing logged yet"
                : `${Math.round(fuelTotals.protein)}g protein of ${fuelTarget.protein}g`}
            </p>
          </div>
          <p className="fuel-left mono">
            {Math.max(0, Math.round(fuelTarget.calories - fuelTotals.calories))}
            <span>left</span>
          </p>
        </button>
      )}

      {/* Last, not first: the quote is a nice thing to land on once the day's
          work is in front of you, not something to read past to reach it. */}
      {quote && (
        <figure className="quote">
          <blockquote className="quote-text">{quote.text}</blockquote>
          <figcaption className="quote-author">{quote.author}</figcaption>
        </figure>
      )}

      {adding && (
        <HabitFormModal
          onSave={(name, icon) => {
            api.addHabit(name, icon);
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      )}

      {editing && (
        <HabitFormModal
          habit={editing}
          onMove={(delta) => api.moveHabit(editing.id, delta)}
          canMoveUp={habits.findIndex((h) => h.id === editing.id) > 0}
          canMoveDown={
            habits.findIndex((h) => h.id === editing.id) < habits.length - 1
          }
          onSave={(name, icon) => {
            api.editHabit(editing.id, name, icon);
            setEditing(null);
          }}
          onDelete={() => {
            api.deleteHabit(editing.id);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
