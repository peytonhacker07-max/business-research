import { useEffect, useState } from "react";

export interface Assignment {
  id: string;
  title: string;
  due: string; // YYYY-MM-DD
  time: string | null;
  course: string | null;
}

/**
 * Brightspace names courses like "BIB224-A - FA-26 - New Testament Literature
 * & Interpretation". The section and term are noise in a heading, so show
 * "BIB224 · New Testament Literature & Interpretation" instead.
 */
export function formatCourseName(course: string): string {
  const parts = course.split(" - ");
  if (parts.length < 3) return course;
  const code = parts[0].split("-")[0];
  const name = parts.slice(2).join(" - ");
  return `${code} · ${name}`;
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
    // no-store: the filename is stable (unlike the hashed JS/CSS bundles), so
    // without this the browser happily serves a cached copy and the app shows
    // assignments from before the last sync.
    fetch(`${import.meta.env.BASE_URL}assignments.json`, { cache: "no-store" })
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
