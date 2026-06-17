import { useEffect, useRef, useState } from "react";
import type { Habit } from "../lib/types";

const SUGGESTED_EMOJI = [
  "✅", "💧", "🏃", "📚", "🧘", "💪", "🥗", "😴",
  "✍️", "🎯", "🌱", "🎸", "🧹", "💊", "☀️", "🚭",
];

interface Props {
  /** When provided, the modal is in edit mode. */
  habit?: Habit;
  onSave: (name: string, icon: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export default function HabitFormModal({ habit, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(habit?.name ?? "");
  const [icon, setIcon] = useState(habit?.icon ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, icon.trim());
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="modal"
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={habit ? "Edit habit" : "New habit"}
      >
        <h2>{habit ? "Edit habit" : "New habit"}</h2>

        <div className="field">
          <label htmlFor="habit-name">Name</label>
          <input
            id="habit-name"
            ref={inputRef}
            type="text"
            value={name}
            maxLength={50}
            placeholder="Drink water, Read, Meditate…"
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Icon (optional)</label>
          <div className="emoji-row">
            <button
              type="button"
              className={"emoji-pick" + (icon === "" ? " selected" : "")}
              aria-pressed={icon === ""}
              onClick={() => setIcon("")}
              title="No icon"
            >
              –
            </button>
            {SUGGESTED_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                className={"emoji-pick" + (icon === e ? " selected" : "")}
                aria-pressed={icon === e}
                onClick={() => setIcon(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!name.trim()}>
            {habit ? "Save" : "Add habit"}
          </button>
        </div>

        {habit && onDelete && (
          <div className="modal-actions" style={{ marginTop: 4 }}>
            <button type="button" className="btn danger block" onClick={onDelete}>
              Delete habit
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
