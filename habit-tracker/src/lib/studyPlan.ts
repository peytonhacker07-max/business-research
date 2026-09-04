import { useEffect, useState } from "react";

export interface PlanDay {
  date: string; // YYYY-MM-DD
  focus: string;
  tasks: string[];
}

export interface StudyPlan {
  generatedFor: string;
  days: PlanDay[];
}

/** Loads the weekly study plan written by scripts/plan-week.mjs. */
export function useStudyPlan(): StudyPlan | null {
  const [plan, setPlan] = useState<StudyPlan | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}study-plan.json`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.days)) setPlan(data);
      })
      .catch(() => {
        /* no plan generated yet — the tab just shows assignments */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return plan;
}
