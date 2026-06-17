import { useCallback, useEffect, useRef, useState } from "react";
import type { AppData, Habit } from "./types";
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
    setData((d) => {
      const maxOrder = d.habits.reduce((m, h) => Math.max(m, h.order), -1);
      const habit: Habit = {
        id: uid(),
        name: name.trim(),
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
      return { habits: d.habits.filter((h) => h.id !== id), completions };
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

  return {
    data,
    today,
    addHabit,
    editHabit,
    deleteHabit,
    moveHabit,
    toggleCompletion,
  };
}
