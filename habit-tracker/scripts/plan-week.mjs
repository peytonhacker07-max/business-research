#!/usr/bin/env node
// Asks Claude to turn the week's synced assignments into a day-by-day study
// plan, written to public/study-plan.json. Runs in CI right after the
// Brightspace sync so it always plans against fresh data.
//
// The API key stays in the ANTHROPIC_API_KEY secret and is only ever used
// here — never shipped to the browser, where it would be readable by anyone.

import fs from "node:fs/promises";

const API_KEY = process.env.ANTHROPIC_API_KEY;
const SCHOOL_TZ = "America/New_York";
const ASSIGNMENTS_PATH = new URL("../public/assignments.json", import.meta.url);
const OUT_PATH = new URL("../public/study-plan.json", import.meta.url);

// Not having a key isn't a failure — the rest of the sync should still run.
if (!API_KEY) {
  console.log("ANTHROPIC_API_KEY is not set — skipping study plan.");
  process.exit(0);
}

function schoolToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

function addDays(dateKey, n) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function formatTime(time) {
  if (!time) return "no set time";
  const [h, m] = time.split(":");
  const h24 = Number(h);
  return `${h24 % 12 || 12}:${m} ${h24 >= 12 ? "PM" : "AM"}`;
}

/** Pulls the JSON object out of a reply, tolerating ``` fences or preamble. */
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

async function main() {
  const assignments = JSON.parse(await fs.readFile(ASSIGNMENTS_PATH, "utf8"));
  const today = schoolToday();
  const weekEnd = addDays(today, 7);

  const upcoming = assignments
    .filter((a) => a.due >= today && a.due <= weekEnd)
    .sort((a, b) =>
      a.due === b.due ? (a.time ?? "").localeCompare(b.time ?? "") : a.due < b.due ? -1 : 1,
    );

  if (upcoming.length === 0) {
    await fs.writeFile(OUT_PATH, JSON.stringify({ generatedFor: today, days: [] }, null, 2) + "\n");
    console.log("Nothing due in the next 7 days — wrote an empty plan.");
    return;
  }

  const list = upcoming
    .map(
      (a) =>
        `- ${a.title} — due ${a.due} at ${formatTime(a.time)}` +
        (a.course ? ` [${a.course}]` : ""),
    )
    .join("\n");

  const prompt = `You are helping a college student plan their week.

Today is ${today}. Here is everything due in the next 7 days, with the class
it belongs to in brackets:

${list}

Build a realistic day-by-day plan covering ${today} through ${weekEnd}. Rules:
- Work backwards from due dates so nothing is left to the last minute.
- Spread the load — don't stack everything on one day.
- Skip days that genuinely need no work rather than inventing filler.
- Each task should say what to actually do, not just restate the assignment name.
- Keep each task under 100 characters.

Reply with ONLY a JSON object, no prose, in exactly this shape:
{"days":[{"date":"YYYY-MM-DD","focus":"short phrase for the day","tasks":["task one","task two"]}]}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.content?.map((b) => b.text ?? "").join("") ?? "";
  const parsed = extractJson(text);

  if (!parsed?.days || !Array.isArray(parsed.days)) {
    throw new Error(`Could not parse a plan from the reply:\n${text.slice(0, 500)}`);
  }

  // Keep only well-formed days inside the window we asked about.
  const days = parsed.days
    .filter(
      (d) =>
        typeof d?.date === "string" &&
        d.date >= today &&
        d.date <= weekEnd &&
        Array.isArray(d.tasks) &&
        d.tasks.length > 0,
    )
    .map((d) => ({
      date: d.date,
      focus: typeof d.focus === "string" ? d.focus : "",
      tasks: d.tasks.filter((t) => typeof t === "string" && t.trim()).slice(0, 6),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  await fs.writeFile(
    OUT_PATH,
    JSON.stringify({ generatedFor: today, days }, null, 2) + "\n",
  );
  console.log(`Wrote a ${days.length}-day study plan covering ${upcoming.length} assignments.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
