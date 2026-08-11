import { useCallback, useEffect, useRef, useState } from "react";
import type { AppData, Habit, Todo, WorkoutEntry } from "./types";
import { completionKey, loadData, saveData } from "./storage";
import { todayKey } from "./dates";

function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export interface AppApi {
  data: AppData;
  /** The current day key; changes trigger re-render on rollover. */
  today: string;
  addHabit: (name: string, icon: string) => void;
  editHabit: (id: string, name: string, icon: string) => void;
  deleteHabit: (id: string) => void;
  moveHabit: (id: string, dir: -1 | 1) => void;
  toggleCompletion: (habitId: string, date: string) => void;
  addTodo: (text: string) => void;
  deleteTodo: (id: string) => void;
  toggleTodo: (id: string) => void;
  reorderTodos: (id: string, dir: -1 | 1) => void;
  setNote: (date: string, content: string) => void;
  addWorkoutEntry: (date: string, exercise: string, sets: number, reps: number, weight: number) => void;
  deleteWorkoutEntry: (id: string) => void;
  setBodyWeight: (date: string, weight: number) => void;
}

export function useAppData(): AppApi {
  const [data, setData] = useState<AppData>(() => loadData());
  const [today, setToday] = useState<string>(() => todayKey());
  const firstRender = useRef(true);

  // Persist (debounced) whenever data changes — but not on the initial mount.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    saveData(data);
  }, [data]);

  // Day rollover: check on focus, on visibility change, and every minute.
  // When the wall-clock date advances, bump `today` so the Today view resets
  // to unchecked while yesterday's records stay locked in history.
  useEffect(() => {
    const check = () => {
      const now = todayKey();
      setToday((prev) => (prev === now ? prev : now));
    };
    const interval = setInterval(check, 60_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  const addHabit = useCallback((name: string, icon: string) => {
    const habitId = uid();
    const trimmedName = name.trim();

    setData((d) => {
      const maxOrder = d.habits.reduce((m, h) => Math.max(m, h.order), -1);
      const habit: Habit = {
        id: habitId,
        name: trimmedName,
        icon: icon.trim(),
        createdAt: todayKey(),
        archived: false,
        order: maxOrder + 1,
      };
      return { ...d, habits: [...d.habits, habit] };
    });
  }, []);

  const editHabit = useCallback((id: string, name: string, icon: string) => {
    setData((d) => ({
      ...d,
      habits: d.habits.map((h) =>
        h.id === id ? { ...h, name: name.trim(), icon: icon.trim() } : h,
      ),
    }));
  }, []);

  const deleteHabit = useCallback((id: string) => {
    setData((d) => {
      const completions = { ...d.completions };
      for (const key of Object.keys(completions)) {
        if (completions[key].habitId === id) delete completions[key];
      }
      return { ...d, habits: d.habits.filter((h) => h.id !== id), completions };
    });
  }, []);

  const moveHabit = useCallback((id: string, dir: -1 | 1) => {
    setData((d) => {
      const ordered = [...d.habits]
        .filter((h) => !h.archived)
        .sort((a, b) => a.order - b.order);
      const idx = ordered.findIndex((h) => h.id === id);
      const swapWith = idx + dir;
      if (idx === -1 || swapWith < 0 || swapWith >= ordered.length) return d;
      // swap order values
      const a = ordered[idx];
      const b = ordered[swapWith];
      const habits = d.habits.map((h) => {
        if (h.id === a.id) return { ...h, order: b.order };
        if (h.id === b.id) return { ...h, order: a.order };
        return h;
      });
      return { ...d, habits };
    });
  }, []);

  const toggleCompletion = useCallback((habitId: string, date: string) => {
    setData((d) => {
      const key = completionKey(habitId, date);
      const completions = { ...d.completions };
      if (completions[key]) delete completions[key];
      else completions[key] = { habitId, date, completed: true };
      return { ...d, completions };
    });
  }, []);

  const addTodo = useCallback((text: string) => {
    setData((d) => {
      const maxOrder = d.todos.reduce((m, t) => Math.max(m, t.order), -1);
      const todo: Todo = {
        id: uid(),
        text: text.trim(),
        done: false,
        createdAt: todayKey(),
        order: maxOrder + 1,
      };
      return { ...d, todos: [...d.todos, todo] };
    });
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      todos: d.todos.filter((t) => t.id !== id),
    }));
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      todos: d.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    }));
  }, []);

  const reorderTodos = useCallback((id: string, dir: -1 | 1) => {
    setData((d) => {
      const todos = [...d.todos].sort((a, b) => a.order - b.order);
      const idx = todos.findIndex((t) => t.id === id);
      const swapIdx = idx + dir;
      if (idx === -1 || swapIdx < 0 || swapIdx >= todos.length) return d;
      const a = todos[idx];
      const b = todos[swapIdx];
      return {
        ...d,
        todos: d.todos.map((t) => {
          if (t.id === a.id) return { ...t, order: b.order };
          if (t.id === b.id) return { ...t, order: a.order };
          return t;
        }),
      };
    });
  }, []);

  const setNote = useCallback((date: string, content: string) => {
    setData((d) => {
      const notes = { ...d.notes };
      if (content) {
        notes[date] = content;
      } else {
        delete notes[date];
      }
      return { ...d, notes };
    });
  }, []);

  const addWorkoutEntry = useCallback(
    (date: string, exercise: string, sets: number, reps: number, weight: number) => {
      setData((d) => {
        const maxOrder = d.workoutEntries.reduce((m, w) => Math.max(m, w.order), -1);
        const entry: WorkoutEntry = {
          id: uid(),
          date,
          exercise: exercise.trim(),
          sets,
          reps,
          weight,
          order: maxOrder + 1,
        };
        return { ...d, workoutEntries: [...d.workoutEntries, entry] };
      });
    },
    [],
  );

  const deleteWorkoutEntry = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      workoutEntries: d.workoutEntries.filter((w) => w.id !== id),
    }));
  }, []);

  const setBodyWeight = useCallback((date: string, weight: number) => {
    setData((d) => ({ ...d, bodyWeight: { ...d.bodyWeight, [date]: weight } }));
  }, []);

  return {
    data,
    today,
    addHabit,
    editHabit,
    deleteHabit,
    moveHabit,
    toggleCompletion,
    addTodo,
    deleteTodo,
    toggleTodo,
    reorderTodos,
    setNote,
    addWorkoutEntry,
    deleteWorkoutEntry,
    setBodyWeight,
  };
}
