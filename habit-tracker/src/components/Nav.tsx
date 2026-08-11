import type { ViewName } from "../lib/types";
import { AnalyticsIcon, TodayIcon, ChecklistIcon, NotesIcon, DumbbellIcon } from "./Icons";

interface Props {
  view: ViewName;
  onChange: (v: ViewName) => void;
}

const ITEMS: { name: ViewName; label: string; Icon: typeof TodayIcon }[] = [
  { name: "today", label: "Today", Icon: TodayIcon },
  { name: "analytics", label: "Analytics", Icon: AnalyticsIcon },
  { name: "todos", label: "Tasks", Icon: ChecklistIcon },
  { name: "notes", label: "Journal", Icon: NotesIcon },
  { name: "workout", label: "Workout", Icon: DumbbellIcon },
];

export default function Nav({ view, onChange }: Props) {
  return (
    <nav className="nav" aria-label="Views">
      {ITEMS.map(({ name, label, Icon }) => (
        <button
          key={name}
          className={view === name ? "active" : ""}
          aria-current={view === name ? "page" : undefined}
          onClick={() => onChange(name)}
        >
          <Icon className="nav-icon" />
          {label}
        </button>
      ))}
    </nav>
  );
}
