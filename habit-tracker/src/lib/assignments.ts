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

// The Brightspace calendar feed doesn't set LOCATION/CATEGORIES with a course
// name, so classify by keywords/patterns in the assignment title instead.
// Order matters — more specific rules first.
const COURSE_RULES: { course: string; test: (title: string) => boolean }[] = [
  { course: "New Testament", test: (t) => /reading quiz/i.test(t) || /scripture memory/i.test(t) },
  { course: "Ethics", test: (t) => /^ethics assignment/i.test(t) },
  {
    course: "Speech Communication",
    test: (t) =>
      /^resume$/i.test(t) ||
      /mock interview/i.test(t) ||
      /formal communications quiz/i.test(t) ||
      /speech/i.test(t) ||
      /^written assignment/i.test(t),
  },
  {
    course: "Marketing Management",
    test: (t) =>
      /^chapters?\s*\d/i.test(t) ||
      /^week\s*\d/i.test(t) ||
      /practice quiz/i.test(t) ||
      /^quiz\s*\d+$/i.test(t) ||
      /quiz.*chap/i.test(t) ||
      /expert session/i.test(t) ||
      /^rd\s*\d+:/i.test(t) ||
      /midterm exam/i.test(t) ||
      /marketing audit/i.test(t) ||
      /storybrand assignment/i.test(t) ||
      /virtual group powerpoints/i.test(t),
  },
];

function classifyByTitle(title: string): string | null {
  for (const rule of COURSE_RULES) {
    if (rule.test(title)) return rule.course;
  }
  return null;
}

/** Loads assignments synced weekly from Brightspace (see scripts/sync-brightspace.mjs). */
export function useAssignments(): Assignment[] {
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}assignments.json`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setAssignments(
            (data as Assignment[]).map((a) => ({ ...a, course: a.course ?? classifyByTitle(a.title) })),
          );
        }
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
