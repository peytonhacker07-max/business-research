import { useState } from "react";
import { useAppData } from "./lib/useAppData";
import type { ViewName } from "./lib/types";
import Nav from "./components/Nav";
import TodayView from "./components/TodayView";
import HistoryView from "./components/HistoryView";
import AnalyticsView from "./components/AnalyticsView";
import ThemeToggle from "./components/ThemeToggle";

export default function App() {
  const api = useAppData();
  const [view, setView] = useState<ViewName>("today");

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-row">
          <p className="eyebrow">Daily</p>
          <ThemeToggle />
        </div>
        <h1>
          {view === "today"
            ? "Today"
            : view === "history"
              ? "History"
              : "Analytics"}
        </h1>
      </header>

      {view === "today" && <TodayView api={api} />}
      {view === "history" && <HistoryView api={api} />}
      {view === "analytics" && <AnalyticsView api={api} />}

      <Nav view={view} onChange={setView} />
    </div>
  );
}
