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

function greetingFor(hour: number): string {
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export default function App() {
  const api = useAppData();
  const [view, setView] = useState<ViewName>("today");

  // Recheck each minute so a session left open doesn't still say "Morning"
  // in the evening.
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);

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
          <p className="eyebrow">Daily</p>
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
      {view === "todos" && <TaskView />}
      {view === "notes" && <NotesView api={api} />}
      {view === "workout" && <WorkoutView api={api} />}

      <Nav view={view} onChange={setView} />
    </div>
  );
}
