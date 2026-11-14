import { useState } from "react";
import type { AppApi } from "../lib/useAppData";
import type { Profile } from "../lib/types";
import { coachNotes, loggedExercises, readiness, suggestNext } from "../lib/coach";
import { latestBodyWeight, macroTargets } from "../lib/nutrition";

const ACTIVITY_LABEL: Record<NonNullable<Profile["activity"]>, string> = {
  sedentary: "Desk job, little exercise",
  light: "Light — 1-3 days a week",
  moderate: "Moderate — 3-5 days a week",
  very: "Hard — 6-7 days a week",
  extra: "Physical job or two-a-days",
};

const GOAL_LABEL: Record<NonNullable<Profile["goal"]>, string> = {
  cut: "Lose fat",
  maintain: "Maintain",
  bulk: "Build muscle",
};

function ProfileForm({ api, onDone }: { api: AppApi; onDone: () => void }) {
  const p = api.data.profile ?? {};
  const [feet, setFeet] = useState(
    p.heightInches ? String(Math.floor(p.heightInches / 12)) : "",
  );
  const [inches, setInches] = useState(
    p.heightInches ? String(p.heightInches % 12) : "",
  );
  const [birthYear, setBirthYear] = useState(p.birthYear ? String(p.birthYear) : "");
  const [sex, setSex] = useState<Profile["sex"]>(p.sex);
  const [activity, setActivity] = useState<Profile["activity"]>(p.activity ?? "moderate");
  const [goal, setGoal] = useState<Profile["goal"]>(p.goal ?? "maintain");

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const ft = Number(feet);
    const inch = Number(inches);
    const totalInches =
      Number.isFinite(ft) && ft > 0 ? ft * 12 + (Number.isFinite(inch) ? inch : 0) : undefined;
    const year = Number(birthYear);
    api.setProfile({
      heightInches: totalInches,
      birthYear: Number.isFinite(year) && year > 1900 ? year : undefined,
      sex,
      activity,
      goal,
    });
    onDone();
  };

  return (
    <form className="card" onSubmit={save}>
      <h3 className="section-label">About you</h3>
      <p className="muted">
        Used only to work out your calorie target. It never leaves this device.
      </p>

      <div className="field">
        <label>Height</label>
        <div className="food-macros">
          <label>
            <span>Feet</span>
            <input type="number" inputMode="numeric" min="0" value={feet} placeholder="5"
              onChange={(e) => setFeet(e.target.value)} />
          </label>
          <label>
            <span>Inches</span>
            <input type="number" inputMode="numeric" min="0" max="11" value={inches} placeholder="10"
              onChange={(e) => setInches(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="field">
        <label htmlFor="birth-year">Year you were born</label>
        <input id="birth-year" type="number" inputMode="numeric" value={birthYear}
          placeholder="2006" onChange={(e) => setBirthYear(e.target.value)} />
      </div>

      <div className="field">
        <label>Sex</label>
        <div className="seg">
          {(["male", "female"] as const).map((s) => (
            <button key={s} type="button" className={"seg-btn" + (sex === s ? " active" : "")}
              onClick={() => setSex(s)}>
              {s === "male" ? "Male" : "Female"}
            </button>
          ))}
        </div>
        <p className="muted small">
          The resting-burn formula uses it. Leave it unset and the app falls back
          to a body-weight estimate instead.
        </p>
      </div>

      <div className="field">
        <label htmlFor="activity">How active are you?</label>
        <select id="activity" value={activity}
          onChange={(e) => setActivity(e.target.value as Profile["activity"])}>
          {Object.entries(ACTIVITY_LABEL).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Goal</label>
        <div className="seg">
          {(Object.keys(GOAL_LABEL) as NonNullable<Profile["goal"]>[]).map((g) => (
            <button key={g} type="button" className={"seg-btn" + (goal === g ? " active" : "")}
              onClick={() => setGoal(g)}>
              {GOAL_LABEL[g]}
            </button>
          ))}
        </div>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn primary">Save</button>
      </div>
    </form>
  );
}

export default function CoachView({ api }: { api: AppApi }) {
  const { data } = api;
  const [editingProfile, setEditingProfile] = useState(false);

  const call = readiness(data);
  const notes = coachNotes(data);
  const target = macroTargets(data);
  const bw = latestBodyWeight(data);

  // The handful of lifts actually in rotation — a suggestion for something
  // last touched in August is noise, not coaching.
  const suggestions = loggedExercises(data)
    .slice(0, 6)
    .map((e) => suggestNext(data, e))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  if (editingProfile) {
    return (
      <div className="coach">
        <ProfileForm api={api} onDone={() => setEditingProfile(false)} />
      </div>
    );
  }

  return (
    <div className="coach">
      <div className={"card readiness " + call.level}>
        <p className="readiness-head">{call.headline}</p>
        <ul className="readiness-reasons">
          {call.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      {suggestions.length > 0 && (
        <section>
          <h3 className="section-label">Next time</h3>
          <ul className="coach-suggestions">
            {suggestions.map((s) => (
              <li key={s.exercise} className={"card coach-suggestion" + (s.stalled ? " stalled" : "")}>
                <div className="coach-suggestion-head">
                  <span className="coach-suggestion-name">{s.exercise}</span>
                  <span className="coach-suggestion-target mono">
                    {s.weight} lb × {s.reps}
                  </span>
                </div>
                <p className="coach-suggestion-reason">{s.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {notes.length > 0 && (
        <section>
          <h3 className="section-label">What I'm seeing</h3>
          <ul className="note-list">
            {notes.map((n) => (
              <li key={n.title} className={"card note " + n.tone}>
                <p className="note-title">{n.title}</p>
                <p className="note-detail">{n.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="section-label">Your targets</h3>
        <div className="card">
          {target ? (
            <>
              <dl className="target-grid">
                <div><dt>Calories</dt><dd className="mono">{target.calories}</dd></div>
                <div><dt>Protein</dt><dd className="mono">{target.protein}g</dd></div>
                <div><dt>Carbs</dt><dd className="mono">{target.carbs}g</dd></div>
                <div><dt>Fat</dt><dd className="mono">{target.fat}g</dd></div>
              </dl>
              <p className="muted small">
                {data.macroTargets
                  ? "Set by hand."
                  : data.profile?.heightInches && data.profile?.birthYear && data.profile?.sex
                    ? `Worked out from ${bw} lb, your height and age, and a goal to ${GOAL_LABEL[data.profile.goal ?? "maintain"].toLowerCase()}.`
                    : `Estimated from ${bw} lb. Add your height and age to sharpen it.`}
              </p>
            </>
          ) : (
            <p className="muted">
              Log your body weight on the Workout tab and targets will follow from it.
            </p>
          )}
          <button className="btn block" onClick={() => setEditingProfile(true)}>
            {data.profile ? "Edit your details" : "Add your details"}
          </button>
        </div>
      </section>
    </div>
  );
}
