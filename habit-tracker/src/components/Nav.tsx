import type { ViewName } from "../lib/types";
import { AnalyticsIcon, TodayIcon, ChecklistIcon, NotesIcon, DumbbellIcon, CalendarIcon } from "./Icons";

interface Props {
  view: ViewName;
  onChange: (v: ViewName) => void;
  /** Classes is hidden entirely until this device is unlocked, so that a
   *  phone without the passphrase shows no sign the coursework exists. */
  showClasses: boolean;
}

const ITEMS: { name: ViewName; label: string; Icon: typeof TodayIcon }[] = [
  { name: "today", label: "Today", Icon: TodayIcon },
  { name: "calendar", label: "Calendar", Icon: CalendarIcon },
  { name: "analytics", label: "Analytics", Icon: AnalyticsIcon },
  { name: "todos", label: "Classes", Icon: ChecklistIcon },
  { name: "notes", label: "Journal", Icon: NotesIcon },
  { name: "workout", label: "Workout", Icon: DumbbellIcon },
];

export default function Nav({ view, onChange, showClasses }: Props) {
  const items = showClasses ? ITEMS : ITEMS.filter((i) => i.name !== "todos");
  return (
    <nav className="nav" aria-label="Views">
      {items.map(({ name, label, Icon }) => (
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
