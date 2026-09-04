import { useEffect, useState } from "react";

export interface Assignment {
  id: string;
  title: string;
  due: string; // YYYY-MM-DD
  time: string | null;
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
