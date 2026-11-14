import { useEffect, useRef, useState } from "react";
import type { Habit } from "../lib/types";
import { ChevronDownIcon, ChevronUpIcon } from "./Icons";

interface Props {
  /** When provided, the modal is in edit mode. */
  habit?: Habit;
  onSave: (name: string, icon: string) => void;
  onDelete?: () => void;
  onClose: () => void;
  /**
   * Reordering. It used to be two 24px arrows on the habit row itself,
   * wedged against the delete-adjacent pencil, where a mis-tap silently
   * rearranged the list. Here there's room to label what the buttons do.
   */
  onMove?: (delta: 1 | -1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export default function HabitFormModal({
  habit,
  onSave,
  onDelete,
  onClose,
  onMove,
  canMoveUp,
  canMoveDown,
}: Props) {
  const [name, setName] = useState(habit?.name ?? "");
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
    onSave(trimmed, "");
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

        {habit && onMove && (canMoveUp || canMoveDown) && (
          <div className="field">
            <label>Position in the list</label>
            <div className="reorder-row">
              <button
                type="button"
                className="btn"
                disabled={!canMoveUp}
                onClick={() => onMove(-1)}
              >
                <ChevronUpIcon className="" /> Move up
              </button>
              <button
                type="button"
                className="btn"
                disabled={!canMoveDown}
                onClick={() => onMove(1)}
              >
                <ChevronDownIcon className="" /> Move down
              </button>
            </div>
          </div>
        )}

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
