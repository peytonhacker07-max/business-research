import { useState } from "react";
import { useAppData } from "./lib/useAppData";
import type { ViewName } from "./lib/types";
import Nav from "./components/Nav";
import TodayView from "./components/TodayView";
import AnalyticsView from "./components/AnalyticsView";
import TaskView from "./components/TaskView";
import NotesView from "./components/NotesView";
import ThemeToggle from "./components/ThemeToggle";
import ColorSchemeSelector from "./components/ColorSchemeSelector";

export default function App() {
  const api = useAppData();
  const [view, setView] = useState<ViewName>("today");

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
        <h1>
          {view === "today"
            ? "Today"
            : view === "analytics"
              ? "Analytics"
              : view === "todos"
                ? "Task List"
                : "Journal"}
        </h1>
      </header>

      {view === "today" && <TodayView api={api} />}
      {view === "analytics" && <AnalyticsView api={api} />}
      {view === "todos" && <TaskView api={api} />}
      {view === "notes" && <NotesView api={api} />}

      <Nav view={view} onChange={setView} />
    </div>
  );
}
