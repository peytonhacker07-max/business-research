import { useState } from "react";
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
import RemindersModal from "./components/RemindersModal";
import { BellIcon } from "./components/Icons";

export default function App() {
  const api = useAppData();
  const [view, setView] = useState<ViewName>("today");
  const [remindersOpen, setRemindersOpen] = useState(false);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-row">
          <p className="eyebrow">Daily</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="icon-btn"
              onClick={() => setRemindersOpen(true)}
              aria-label="Assignment reminders"
              title="Assignment reminders"
            >
              <BellIcon className="" />
            </button>
            <ColorSchemeSelector />
            <ThemeToggle />
          </div>
        </div>
        <h1>
          {view === "today"
            ? "Today"
            : view === "calendar"
              ? "Calendar"
              : view === "analytics"
                ? "Analytics"
                : view === "todos"
                  ? "Classes"
                  : view === "notes"
                    ? "Journal"
                    : "Workout"}
        </h1>
      </header>

      {view === "today" && <TodayView api={api} />}
      {view === "calendar" && <CalendarView api={api} />}
      {view === "analytics" && <AnalyticsView api={api} />}
      {view === "todos" && <TaskView />}
      {view === "notes" && <NotesView api={api} />}
      {view === "workout" && <WorkoutView api={api} />}

      <Nav view={view} onChange={setView} />

      {remindersOpen && <RemindersModal onClose={() => setRemindersOpen(false)} />}
    </div>
  );
}
