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

function parseIcsDate(value) {
  const digits = value.replace(/[^0-9TZ]/g, "");
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);
  let time = null;
  if (digits.includes("T")) {
    const t = digits.split("T")[1] || "";
    const hh = t.slice(0, 2);
    const mm = t.slice(2, 4);
    if (hh && mm) time = `${hh}:${mm}`;
  }
  return { date: `${y}-${m}-${d}`, time };
}

function unescapeIcsText(value) {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
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
    let uid = null;

    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const rawKey = line.slice(0, colonIdx);
      const value = line.slice(colonIdx + 1);
      const key = rawKey.split(";")[0].toUpperCase();

      if (key === "SUMMARY") summary = unescapeIcsText(value);
      else if (key === "DTSTART") dtstart = parseIcsDate(value);
      else if (key === "UID") uid = value.trim();
    }

    if (!summary || !dtstart) continue;

    // Brightspace titles often end with " - Due" — trim that for display.
    const title = summary.replace(/\s*-\s*Due\s*$/i, "").trim();

    events.push({
      id: uid || `${dtstart.date}-${title}`,
      title,
      due: dtstart.date,
      time: dtstart.time,
    });
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
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));

  await fs.writeFile(OUT_PATH, JSON.stringify(result, null, 2) + "\n");
  console.log(`Wrote ${result.length} assignments to ${OUT_PATH.pathname}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
