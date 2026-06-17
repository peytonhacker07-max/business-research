import type { ViewName } from "../lib/types";
import { AnalyticsIcon, HistoryIcon, TodayIcon } from "./Icons";

interface Props {
  view: ViewName;
  onChange: (v: ViewName) => void;
}

const ITEMS: { name: ViewName; label: string; Icon: typeof TodayIcon }[] = [
  { name: "today", label: "Today", Icon: TodayIcon },
  { name: "history", label: "History", Icon: HistoryIcon },
  { name: "analytics", label: "Analytics", Icon: AnalyticsIcon },
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
