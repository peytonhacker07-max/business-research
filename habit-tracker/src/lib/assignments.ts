import { useEffect, useState } from "react";

export interface Assignment {
  id: string;
  title: string;
  due: string; // YYYY-MM-DD
  time: string | null;
  course: string | null;
}

/** "13:00" -> "1:00 PM". Returns null if there's no time (all-day event). */
export function formatAssignmentTime(time: string | null): string | null {
  if (!time) return null;
  const [hStr, mStr] = time.split(":");
  const h24 = Number(hStr);
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${mStr} ${period}`;
}

/** Loads assignments synced weekly from Brightspace (see scripts/sync-brightspace.mjs). */
export function useAssignments(): Assignment[] {
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}assignments.json`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setAssignments(data);
      })
      .catch(() => {
        /* file may not exist yet before the first sync — ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return assignments;
}
