import { useEffect, useState } from "react";
import { useAppData } from "./lib/useAppData";
import type { ViewName } from "./lib/types";
import Nav from "./components/Nav";
import TodayView from "./components/TodayView";
import AnalyticsView from "./components/AnalyticsView";
import TaskView from "./components/TaskView";
import NotesView from "./components/NotesView";
import WorkoutView from "./components/WorkoutView";
import CalendarView from "./components/CalendarView";
import ThemeToggle from "./components/ThemeToggle";
import ColorSchemeSelector from "./components/ColorSchemeSelector";
import { hasPassphrase, savePassphrase, verifyPassphrase } from "./lib/assignments";
import { clearHealthFragment, readHealthFromFragment } from "./lib/health";

function greetingFor(hour: number): string {
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export default function App() {
  const api = useAppData();
  const [view, setView] = useState<ViewName>("today");

  // A Shortcut opens the app with Health figures after a "#". Read them once
  // on mount, then strip the fragment so it isn't left sitting in history.
  const { mergeHealth } = api;
  useEffect(() => {
    const days = readHealthFromFragment();
    if (Object.keys(days).length > 0) {
      mergeHealth(days);
      clearHealthFragment();
    }
  }, [mergeHealth]);

  // Recheck each minute so a session left open doesn't still say "Morning"
  // in the evening.
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Classes stays hidden until this device proves it has the passphrase, so
  // a borrowed or shared phone shows no hint the coursework exists. Five taps
  // on the "Daily" label is the way back in once it's hidden.
  const [unlocked, setUnlocked] = useState(() => hasPassphrase());
  const [taps, setTaps] = useState(0);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockDraft, setUnlockDraft] = useState("");
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockWrong, setUnlockWrong] = useState(false);

  const handleEyebrowTap = () => {
    if (unlocked) return;
    const next = taps + 1;
    setTaps(next);
    if (next >= 5) {
      setTaps(0);
      setUnlockWrong(false);
      setUnlockDraft("");
      setUnlockOpen(true);
    }
  };

  const submitUnlock = async () => {
    setUnlockBusy(true);
    setUnlockWrong(false);
    const ok = await verifyPassphrase(unlockDraft.trim());
    setUnlockBusy(false);
    if (!ok) {
      setUnlockWrong(true);
      return;
    }
    savePassphrase(unlockDraft.trim());
    setUnlocked(true);
    setUnlockOpen(false);
    setView("todos");
  };

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const startEditingName = () => {
    setNameDraft(api.data.name ?? "");
    setEditingName(true);
  };
  const commitName = () => {
    api.setName(nameDraft);
    setEditingName(false);
  };

  const greeting = greetingFor(hour);
  const todayHeading = api.data.name ? `${greeting}, ${api.data.name}` : greeting;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-row">
          <p className="eyebrow" onClick={handleEyebrowTap}>
            Daily
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <ColorSchemeSelector />
            <ThemeToggle />
          </div>
        </div>
        {view === "today" && editingName ? (
          <input
            className="name-input"
            autoFocus
            value={nameDraft}
            placeholder="What should I call you?"
            maxLength={24}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") setEditingName(false);
            }}
          />
        ) : (
          <h1>
            {view === "today" ? (
              <button
                className="greeting"
                onClick={startEditingName}
                title="Tap to change what you're called"
              >
                {todayHeading}
              </button>
            ) : view === "calendar" ? (
              "Calendar"
            ) : view === "analytics" ? (
              "Analytics"
            ) : view === "todos" ? (
              "Classes"
            ) : view === "notes" ? (
              "Journal"
            ) : (
              "Workout"
            )}
          </h1>
        )}
      </header>

      {view === "today" && <TodayView api={api} />}
      {view === "calendar" && <CalendarView api={api} />}
      {view === "analytics" && <AnalyticsView api={api} />}
      {view === "todos" && unlocked && <TaskView />}
      {view === "notes" && <NotesView api={api} />}
      {view === "workout" && <WorkoutView api={api} />}

      <Nav view={view} onChange={setView} showClasses={unlocked} />

      {unlockOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setUnlockOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Unlock classes">
            <h2>Unlock classes</h2>
            <p className="reminder-note">
              Enter your passphrase to show your coursework on this device.
            </p>
            <input
              className="passphrase-input"
              type="password"
              autoFocus
              autoComplete="off"
              value={unlockDraft}
              placeholder="Passphrase"
              onChange={(e) => setUnlockDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitUnlock(); }}
            />
            {unlockWrong && <p className="passphrase-error">That passphrase didn&rsquo;t work.</p>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setUnlockOpen(false)}>Cancel</button>
              <button className="btn primary" onClick={submitUnlock} disabled={unlockBusy || !unlockDraft.trim()}>
                {unlockBusy ? "Checking\u2026" : "Unlock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
