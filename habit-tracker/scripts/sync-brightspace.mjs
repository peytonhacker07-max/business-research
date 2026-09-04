#!/usr/bin/env node
// Fetches the Brightspace calendar feed (ICS) and writes upcoming assignments
// to public/assignments.json for the app to display. Run weekly by
// .github/workflows/sync-brightspace.yml — never run with a real feed URL
// outside CI, and never commit the URL itself anywhere.

import fs from "node:fs/promises";

const ICS_URL = process.env.BRIGHTSPACE_ICS_URL;
const OUT_PATH = new URL("../public/assignments.json", import.meta.url);

if (!ICS_URL) {
  console.error("BRIGHTSPACE_ICS_URL is not set — skipping sync.");
  process.exit(1);
}

function unfold(text) {
  // ICS wraps long lines with a leading space/tab on the continuation line.
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

// The DTSTART values in the feed are in UTC (a trailing "Z") or a source
// TZID — never assume the raw digits are already wall-clock time for the
// school, or every due time (and sometimes the due *date*, for late-night
// due times) comes out wrong. Everything gets normalized to the school's
// local timezone.
const SCHOOL_TZ = "America/New_York";

/** What a UTC instant reads as on a wall clock in `timeZone`. */
function wallClockInZone(utcMillis, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMillis));
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    hh: map.hour === "24" ? 0 : Number(map.hour),
    mm: Number(map.minute),
    ss: Number(map.second),
  };
}

/** UTC instant for a wall-clock date/time as read in `timeZone`. */
function zonedWallClockToUtcMillis(y, m, d, hh, mm, ss, timeZone) {
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss);
  const offsetAt = (utcMillis) => {
    const wall = wallClockInZone(utcMillis, timeZone);
    return Date.UTC(wall.y, wall.m - 1, wall.d, wall.hh, wall.mm, wall.ss) - utcMillis;
  };
  // One correction pass is enough unless the wall-clock time falls in a DST
  // transition gap/overlap, which due dates never do in practice.
  return guess - offsetAt(guess);
}

const pad = (n, len = 2) => String(n).padStart(len, "0");

function parseIcsDate(rawKey, value) {
  const digits = value.replace(/[^0-9TZ]/g, "");
  const isAllDay = !digits.includes("T");
  if (isAllDay) {
    return { date: `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`, time: null };
  }

  const y = Number(digits.slice(0, 4));
  const m = Number(digits.slice(4, 6));
  const d = Number(digits.slice(6, 8));
  const t = digits.split("T")[1] || "";
  const hh = Number(t.slice(0, 2));
  const mm = Number(t.slice(2, 4));
  const ss = Number(t.slice(4, 6)) || 0;
  const tzidMatch = rawKey.match(/TZID=([^;:]+)/i);

  let wall;
  if (digits.endsWith("Z")) {
    wall = wallClockInZone(Date.UTC(y, m - 1, d, hh, mm, ss), SCHOOL_TZ);
  } else if (tzidMatch && tzidMatch[1] !== SCHOOL_TZ) {
    const utcMillis = zonedWallClockToUtcMillis(y, m, d, hh, mm, ss, tzidMatch[1]);
    wall = wallClockInZone(utcMillis, SCHOOL_TZ);
  } else {
    // Either already TZID=<school zone>, or a floating time with no zone —
    // both are treated as already being the school's local time.
    wall = { y, m, d, hh, mm };
  }

  return {
    date: `${pad(wall.y, 4)}-${pad(wall.m)}-${pad(wall.d)}`,
    time: `${pad(wall.hh)}:${pad(wall.mm)}`,
  };
}

function unescapeIcsText(value) {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function stripHtml(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Best-effort course/class name for an event, from whatever fields the feed sets. */
function guessCourse(location, categories, description) {
  if (location && !/^https?:\/\//i.test(location)) return location;
  if (categories) {
    const first = categories.split(",")[0]?.trim();
    if (first) return first;
  }
  if (description) {
    const text = stripHtml(description);
    const match = text.match(/course\s*:?\s*([^.\n]+)/i);
    if (match) return match[1].trim();
  }
  return null;
}

async function main() {
  const res = await fetch(ICS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch calendar feed: ${res.status} ${res.statusText}`);
  }
  const text = unfold(await res.text());
  const blocks = text.split("BEGIN:VEVENT").slice(1);

  const events = [];
  for (const block of blocks) {
    const body = block.split("END:VEVENT")[0];
    const lines = body
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    let summary = null;
    let dtstart = null;
    let rawDtstart = null;
    let uid = null;
    let location = null;
    let categories = null;
    let description = null;

    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const rawKey = line.slice(0, colonIdx);
      const value = line.slice(colonIdx + 1);
      const key = rawKey.split(";")[0].toUpperCase();

      if (key === "SUMMARY") summary = unescapeIcsText(value);
      else if (key === "DTSTART") {
        rawDtstart = line;
        dtstart = parseIcsDate(rawKey, value);
      }
      else if (key === "UID") uid = value.trim();
      else if (key === "LOCATION") location = unescapeIcsText(value);
      else if (key === "CATEGORIES") categories = unescapeIcsText(value);
      else if (key === "DESCRIPTION") description = unescapeIcsText(value);
    }

    if (!summary || !dtstart) continue;

    // Brightspace titles often end with " - Due" — trim that for display.
    const title = summary.replace(/\s*-\s*Due\s*$/i, "").trim();

    events.push({
      id: uid || `${dtstart.date}-${title}`,
      title,
      due: dtstart.date,
      time: dtstart.time,
      course: guessCourse(location, categories, description),
      rawDtstart,
    });
  }

  // Log how the feed actually encodes its timestamps so the timezone handling
  // above can be verified against the real feed rather than assumed. Only the
  // DTSTART lines are logged — never the feed URL.
  const formatCounts = { utcZ: 0, tzid: 0, floating: 0, dateOnly: 0 };
  for (const e of events) {
    const raw = e.rawDtstart ?? "";
    if (!raw.includes("T")) formatCounts.dateOnly++;
    else if (raw.trimEnd().endsWith("Z")) formatCounts.utcZ++;
    else if (/TZID=/i.test(raw)) formatCounts.tzid++;
    else formatCounts.floating++;
  }
  console.log("DTSTART formats:", JSON.stringify(formatCounts));
  console.log("Sample DTSTART -> converted local due date/time:");
  for (const e of events.slice(0, 5)) {
    console.log(`  ${e.rawDtstart}  ->  ${e.due} ${e.time ?? "(all day)"}  |  ${e.title}`);
  }

  // Keep a reasonable window so the file doesn't grow unbounded.
  const today = new Date();
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - 3);
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + 90);
  const toKey = (d) => d.toISOString().slice(0, 10);
  const startKey = toKey(windowStart);
  const endKey = toKey(windowEnd);

  const seen = new Set();
  const result = events
    .filter((e) => e.due >= startKey && e.due <= endKey)
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) =>
      a.due === b.due ? (a.time ?? "").localeCompare(b.time ?? "") : a.due < b.due ? -1 : 1,
    )
    .map(({ rawDtstart, ...rest }) => rest);

  await fs.writeFile(OUT_PATH, JSON.stringify(result, null, 2) + "\n");
  console.log(`Wrote ${result.length} assignments to ${OUT_PATH.pathname}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
