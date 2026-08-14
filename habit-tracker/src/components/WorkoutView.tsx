import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { AppApi } from "../lib/useAppData";
import { addDays, fromKey, formatLong, monthShort, toKey } from "../lib/dates";
import { addPhoto, deletePhoto, getPhotos, resizeImage } from "../lib/photos";
import type { Photo } from "../lib/photos";
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

/**
 * In-page camera capture. Grabs a frame straight from the live video stream
 * into a canvas — it never hands off to the native Camera app, so nothing
 * is written to the device's camera roll / Photos library.
 */
function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError("Couldn't access the camera. Check camera permissions and try again."));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const maxDim = 1280;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    onCapture(canvas.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ padding: 12 }}>
        {error ? (
          <p style={{ fontSize: 14, color: "var(--danger)", margin: "8px 0 16px" }}>{error}</p>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%",
              borderRadius: 12,
              display: "block",
              marginBottom: 12,
              background: "#000",
              aspectRatio: "3 / 4",
              objectFit: "cover",
            }}
          />
        )}
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          {!error && (
            <button className="btn primary" onClick={handleCapture}>
              Capture
            </button>
          )}
        </div>
      </div>
    </div>
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

  // Group same-exercise sets together (e.g. "9 reps" and "10 reps" logged
  // separately because the weight didn't match) so they render connected
  // instead of as unrelated rows.
  const entryGroups = useMemo(() => {
    const order: string[] = [];
    const byKey = new Map<string, typeof entries>();
    for (const e of entries) {
      const key = e.exercise.trim().toLowerCase();
      if (!byKey.has(key)) {
        byKey.set(key, []);
        order.push(key);
      }
      byKey.get(key)!.push(e);
    }
    return order.map((key) => {
      const group = byKey.get(key)!;
      return { exercise: group[0].exercise, entries: group };
    });
  }, [entries]);

  const knownExercises = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const w of data.workoutEntries) {
      const key = w.exercise.trim().toLowerCase();
      if (!byKey.has(key)) byKey.set(key, w.exercise);
    }
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
  }, [data.workoutEntries]);

  const [exercise, setExercise] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    const q = exercise.trim().toLowerCase();
    const pool = q
      ? knownExercises.filter((ex) => ex.toLowerCase().includes(q) && ex.toLowerCase() !== q)
      : knownExercises;
    return pool.slice(0, 8);
  }, [exercise, knownExercises]);

  const handleAdd = () => {
    const name = exercise.trim();
    const s = parseInt(sets, 10);
    const r = parseInt(reps, 10);
    const w = parseFloat(weight);
    if (!name || !s || !r || !w) return;
    api.addWorkoutEntry(selectedDate, name, s, r, w, note);
    setExercise("");
    setSets("");
    setReps("");
    setWeight("");
    setNote("");
    setShowSuggestions(false);
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

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getPhotos(selectedDate).then((p) => {
      if (!cancelled) setPhotos(p);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const handlePhotoSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await resizeImage(file);
      const photo = await addPhoto(selectedDate, dataUrl);
      setPhotos((prev) => [...prev, photo]);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (id: string) => {
    await deletePhoto(id);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    setViewingPhoto(null);
  };

  const handleCameraCapture = async (dataUrl: string) => {
    setShowCamera(false);
    const photo = await addPhoto(selectedDate, dataUrl);
    setPhotos((prev) => [...prev, photo]);
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
          FOCUS
        </p>
        <input
          className="workout-name-input"
          style={{ marginBottom: 0 }}
          type="text"
          placeholder="e.g. Chest & Back, Legs, Push Day"
          value={data.workoutFocus[selectedDate] || ""}
          onChange={(e) => api.setWorkoutFocus(selectedDate, e.target.value)}
        />
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
        <div style={{ position: "relative" }}>
          <input
            className="workout-name-input"
            type="text"
            placeholder="Exercise name"
            autoComplete="off"
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="suggestion-list">
              {suggestions.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="suggestion-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setExercise(ex);
                    setShowSuggestions(false);
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>
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
        <input
          className="workout-name-input"
          type="text"
          placeholder="Notes (optional) — e.g. went to failure, partial reps"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="btn primary block" onClick={handleAdd} style={{ marginBottom: entries.length ? 14 : 0 }}>
          <PlusIcon className="" />
          Add Exercise
        </button>

        {entries.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-faint)", textAlign: "center", margin: 0 }}>
            Nothing logged {isToday ? "yet today" : "for this day"}.
          </p>
        ) : (
          entryGroups.map((group, gi) => (
            <div
              key={group.exercise + gi}
              style={{ marginBottom: gi === entryGroups.length - 1 ? 0 : 16 }}
            >
              <div className="habit-name" style={{ marginBottom: 4 }}>
                {group.exercise}
              </div>
              {group.entries.map((entry, i) => (
                <div key={entry.id} style={{ display: "flex", gap: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      width: 10,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--accent)",
                        marginTop: 7,
                        flexShrink: 0,
                      }}
                    />
                    {i < group.entries.length - 1 && (
                      <div style={{ width: 2, flex: 1, background: "var(--line-strong)" }} />
                    )}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      paddingBottom: i === group.entries.length - 1 ? 0 : 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div className="mono" style={{ fontSize: 13, color: "var(--ink-soft)", paddingTop: 3 }}>
                        {entry.sets} × {entry.reps} @ {entry.weight} lb
                      </div>
                      <button
                        className="icon-btn"
                        onClick={() => api.deleteWorkoutEntry(entry.id)}
                        style={{ flexShrink: 0 }}
                      >
                        <span style={{ fontSize: 14, lineHeight: 1 }}>×</span>
                      </button>
                    </div>
                    {entry.note && (
                      <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2, fontStyle: "italic" }}>
                        {entry.note}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14, marginTop: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", margin: "0 0 10px" }}>
          PHOTOS
        </p>
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => setViewingPhoto(photo)}
              style={{
                flexShrink: 0,
                width: 72,
                height: 72,
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid var(--line)",
                padding: 0,
                background: "none",
              }}
            >
              <img
                src={photo.dataUrl}
                alt="Workout"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </button>
          ))}
          <button
            onClick={() => setShowCamera(true)}
            disabled={uploading}
            style={{
              flexShrink: 0,
              width: 72,
              height: 72,
              borderRadius: 10,
              border: "1px dashed var(--line-strong)",
              background: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-soft)",
            }}
          >
            <span style={{ width: 20, height: 20, display: "flex" }}>
              <PlusIcon className="" />
            </span>
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--ink-faint)", margin: "6px 0 0" }}>
          Taken in-app — never saved to your camera roll.{" "}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              font: "inherit",
              fontSize: 11,
              color: "var(--ink-soft)",
              textDecoration: "underline",
            }}
          >
            Choose from library instead
          </button>
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handlePhotoSelected}
        />
      </div>

      {showCamera && (
        <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
      )}

      {viewingPhoto && (
        <div className="modal-backdrop" onClick={() => setViewingPhoto(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ padding: 12 }}>
            <img
              src={viewingPhoto.dataUrl}
              alt="Workout"
              style={{ width: "100%", borderRadius: 12, display: "block", marginBottom: 12 }}
            />
            <div className="modal-actions">
              <button className="btn danger" onClick={() => handleDeletePhoto(viewingPhoto.id)}>
                Delete
              </button>
              <button className="btn primary" onClick={() => setViewingPhoto(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const BODY_WEIGHT = "Body Weight";
type Metric = "weight" | "reps";

function ProgressSection({ api }: { api: AppApi }) {
  const { data } = api;
  const exercises = useMemo(() => {
    // Group case/whitespace variants of the same name together, keeping
    // whichever casing was logged first as the display name.
    const byKey = new Map<string, string>();
    for (const w of data.workoutEntries) {
      const key = w.exercise.trim().toLowerCase();
      if (!byKey.has(key)) byKey.set(key, w.exercise);
    }
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
  }, [data.workoutEntries]);

  const options = [BODY_WEIGHT, ...exercises];
  const [selected, setSelected] = useState<string>(BODY_WEIGHT);
  const active = options.includes(selected) ? selected : options[0];
  const isWeight = active === BODY_WEIGHT;

  const [metric, setMetric] = useState<Metric>("weight");
  const activeMetric = isWeight ? "weight" : metric;

  const series = useMemo(() => {
    if (isWeight) {
      return Object.entries(data.bodyWeight)
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([date, value]) => {
          const d = fromKey(date);
          return { label: `${monthShort(d.getMonth())} ${d.getDate()}`, value };
        });
    }
    const activeKey = active.trim().toLowerCase();
    const byDate = new Map<string, number>();
    for (const e of data.workoutEntries) {
      if (e.exercise.trim().toLowerCase() !== activeKey) continue;
      const val = activeMetric === "reps" ? e.reps : e.weight;
      byDate.set(e.date, Math.max(byDate.get(e.date) ?? 0, val));
    }
    return Array.from(byDate.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([date, value]) => {
        const d = fromKey(date);
        return { label: `${monthShort(d.getMonth())} ${d.getDate()}`, value };
      });
  }, [isWeight, active, activeMetric, data.bodyWeight, data.workoutEntries]);

  if (exercises.length === 0 && Object.keys(data.bodyWeight).length === 0) {
    return (
      <div className="empty">
        <h2>No progress yet</h2>
        <p>Log your weight or an exercise in the Day tab and your chart will show up here.</p>
      </div>
    );
  }

  const current = series[series.length - 1]?.value ?? 0;

  return (
    <div>
      <select
        className="exercise-select"
        value={active}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value={BODY_WEIGHT}>Body Weight</option>
        {exercises.map((ex) => (
          <option key={ex} value={ex}>
            {ex}
          </option>
        ))}
      </select>

      {!isWeight && (
        <div className="range-tabs" role="tablist" aria-label="Metric">
          {(["weight", "reps"] as Metric[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={metric === m}
              className={metric === m ? "active" : ""}
              onClick={() => setMetric(m)}
            >
              {m === "weight" ? "Weight" : "Reps"}
            </button>
          ))}
        </div>
      )}

      {series.length === 0 ? (
        <div className="empty">
          <h2>Nothing logged yet</h2>
          <p>
            {isWeight
              ? "Log your weight in the Day tab to start this chart."
              : `Log a "${active}" session in the Day tab to start this chart.`}
          </p>
        </div>
      ) : (
        <>
          <div className="chart-card">
            <h3>
              {isWeight
                ? "Body Weight"
                : `${active} — ${activeMetric === "reps" ? "Max Reps" : "Max Weight"}`}
            </h3>
            <SimpleLineChart series={series} />
          </div>

          {isWeight ? (
            <div className="stat-grid">
              <div className="stat-box">
                <div className="stat-num mono">{current} lb</div>
                <div className="stat-cap">Current</div>
              </div>
              <div className="stat-box">
                <div className="stat-num mono">
                  {(() => {
                    const change = Math.round((current - series[0].value) * 10) / 10;
                    return `${change > 0 ? "+" : ""}${change} lb`;
                  })()}
                </div>
                <div className="stat-cap">Since {series[0].label}</div>
              </div>
              <div className="stat-box">
                <div className="stat-num mono">{series.length}</div>
                <div className="stat-cap">Entries logged</div>
              </div>
            </div>
          ) : (
            <div className="stat-grid">
              <div className="stat-box">
                <div className="stat-num mono">
                  {current}
                  {activeMetric === "weight" ? " lb" : ""}
                </div>
                <div className="stat-cap">Current max{activeMetric === "reps" ? " reps" : ""}</div>
              </div>
              <div className="stat-box">
                <div className="stat-num mono">
                  {Math.max(...series.map((s) => s.value))}
                  {activeMetric === "weight" ? " lb" : ""}
                </div>
                <div className="stat-cap">All-time {activeMetric === "reps" ? "best" : "PR"}</div>
              </div>
              <div className="stat-box">
                <div className="stat-num mono">{series.length}</div>
                <div className="stat-cap">Sessions logged</div>
              </div>
            </div>
          )}
        </>
      )}
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
