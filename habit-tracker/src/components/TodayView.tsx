import { useState } from "react";
import type { AppApi } from "../lib/useAppData";
import { activeHabits, currentStreak, isDone, todayProgress } from "../lib/streaks";
import { formatLong } from "../lib/dates";
import ProgressRing from "./ProgressRing";
import HabitFormModal from "./HabitFormModal";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  PlusIcon,
} from "./Icons";
import type { Habit } from "../lib/types";

export default function TodayView({ api }: { api: AppApi }) {
  const { data, today } = api;
  const habits = activeHabits(data);
  const { done, total } = todayProgress(data);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);

  return (
    <div className="view">
      <ProgressRing done={done} total={total} />

      <p className="view-title" style={{ textAlign: "center", marginTop: 4 }}>
        {formatLong(new Date())}
      </p>

      {habits.length === 0 ? (
        <div className="empty">
          <div className="mark">🌱</div>
          <h2>Start your first habit</h2>
          <p>Pick one small thing to do every day.</p>
          <button className="btn primary" onClick={() => setAdding(true)}>
            <PlusIcon className="" /> Add a habit
          </button>
        </div>
      ) : (
        <>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {habits.map((habit, i) => {
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
                        aria-label={`Move ${habit.name} up`}
                        disabled={i === 0}
                        onClick={() => api.moveHabit(habit.id, -1)}
                      >
                        <ChevronUpIcon className="" />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`Move ${habit.name} down`}
                        disabled={i === habits.length - 1}
                        onClick={() => api.moveHabit(habit.id, 1)}
                      >
                        <ChevronDownIcon className="" />
                      </button>
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
