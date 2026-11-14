import { useState } from "react";
import type { AppApi } from "../lib/useAppData";
import type { FoodEntry } from "../lib/types";
import {
  dayTotals,
  energyOut,
  foodFor,
  latestBodyWeight,
  macroTargets,
  recentFoods,
} from "../lib/nutrition";
import { PlusIcon, XIcon } from "./Icons";

/** A macro's progress toward its target, as a labelled bar. */
function MacroBar({
  label,
  value,
  target,
  unit,
}: {
  label: string;
  value: number;
  target?: number;
  unit: string;
}) {
  const pct = target && target > 0 ? Math.min(100, (value / target) * 100) : 0;
  // Over target is worth seeing, but the bar shouldn't grow past its track —
  // the number says by how much.
  const over = target !== undefined && value > target;
  return (
    <div className="macro-bar">
      <div className="macro-bar-head">
        <span className="macro-label">{label}</span>
        <span className={"macro-value" + (over ? " over" : "")}>
          <strong className="mono">{Math.round(value)}</strong>
          {target !== undefined && (
            <span className="macro-target mono"> / {Math.round(target)}</span>
          )}
          {unit}
        </span>
      </div>
      <div className="macro-track">
        <div
          className={"macro-fill" + (over ? " over" : "")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function FoodView({ api }: { api: AppApi }) {
  const { data, today } = api;

  const entries = foodFor(data, today);
  const totals = dayTotals(data, today);
  const target = macroTargets(data, today);
  const burned = energyOut(data, today);
  const recent = recentFoods(data).filter(
    // Already eaten today — re-logging from the shortcut list would duplicate.
    (r) => !entries.some((e) => e.name === r.name && e.calories === r.calories),
  );

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const reset = () => {
    setName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
  };

  const n = (s: string) => {
    const v = Number(s);
    return Number.isFinite(v) && v > 0 ? v : 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    api.addFood(today, {
      name,
      calories: n(calories),
      protein: n(protein),
      carbs: n(carbs),
      fat: n(fat),
    });
    reset();
    setOpen(false);
  };

  const logAgain = (f: FoodEntry) =>
    api.addFood(today, {
      name: f.name,
      calories: f.calories,
      protein: f.protein,
      carbs: f.carbs,
      fat: f.fat,
    });

  const remaining = target ? target.calories - totals.calories : undefined;

  return (
    <div className="food">
      <div className="card">
        {target ? (
          <>
            <div className="food-headline">
              <div>
                <p className="food-remaining mono">
                  {remaining !== undefined && remaining >= 0
                    ? Math.round(remaining)
                    : `+${Math.abs(Math.round(remaining ?? 0))}`}
                </p>
                <p className="food-remaining-label">
                  {remaining !== undefined && remaining >= 0
                    ? "calories left"
                    : "over target"}
                </p>
              </div>
              {burned !== undefined && (
                <div className="food-burned">
                  <dt>Burned</dt>
                  <dd className="mono">{burned.toLocaleString()}</dd>
                </div>
              )}
            </div>

            <div className="macro-bars">
              <MacroBar label="Calories" value={totals.calories} target={target.calories} unit="" />
              <MacroBar label="Protein" value={totals.protein} target={target.protein} unit="g" />
              <MacroBar label="Carbs" value={totals.carbs} target={target.carbs} unit="g" />
              <MacroBar label="Fat" value={totals.fat} target={target.fat} unit="g" />
            </div>
          </>
        ) : (
          <div className="food-no-target">
            <h3>No targets yet</h3>
            <p>
              {latestBodyWeight(data) === undefined
                ? "Log your body weight on the Workout tab and targets will be worked out from it."
                : "Set your height, age and goal in Coach to sharpen the numbers."}
            </p>
            <div className="macro-bars">
              <MacroBar label="Calories" value={totals.calories} unit="" />
              <MacroBar label="Protein" value={totals.protein} unit="g" />
              <MacroBar label="Carbs" value={totals.carbs} unit="g" />
              <MacroBar label="Fat" value={totals.fat} unit="g" />
            </div>
          </div>
        )}
      </div>

      {!open && (
        <button className="btn primary block" onClick={() => setOpen(true)}>
          <PlusIcon className="" /> Log food
        </button>
      )}

      {open && (
        <form className="card food-form" onSubmit={submit}>
          <input
            className="food-name"
            autoFocus
            value={name}
            maxLength={60}
            placeholder="What did you eat?"
            onChange={(e) => setName(e.target.value)}
          />
          <div className="food-macros">
            {([
              ["Cal", calories, setCalories],
              ["Protein", protein, setProtein],
              ["Carbs", carbs, setCarbs],
              ["Fat", fat, setFat],
            ] as const).map(([label, value, set]) => (
              <label key={label}>
                <span>{label}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={value}
                  placeholder="0"
                  onChange={(e) => set(e.target.value)}
                />
              </label>
            ))}
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={!name.trim()}>
              Add
            </button>
          </div>
        </form>
      )}

      {recent.length > 0 && (
        <section>
          <h3 className="section-label">Log again</h3>
          <div className="chip-row">
            {recent.map((f) => (
              <button key={f.id} className="chip" onClick={() => logAgain(f)}>
                {f.name}
                <span className="chip-sub mono">{Math.round(f.calories)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="section-label">Today</h3>
        {entries.length === 0 ? (
          <p className="muted">Nothing logged yet.</p>
        ) : (
          <ul className="food-list">
            {entries.map((f) => (
              <li key={f.id} className="food-item">
                <div className="food-item-body">
                  <div className="food-item-name">{f.name}</div>
                  <div className="food-item-macros mono">
                    {Math.round(f.calories)} cal · {Math.round(f.protein)}p ·{" "}
                    {Math.round(f.carbs)}c · {Math.round(f.fat)}f
                  </div>
                </div>
                <button
                  className="icon-btn"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => api.deleteFood(f.id)}
                >
                  <XIcon className="" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
