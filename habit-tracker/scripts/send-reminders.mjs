#!/usr/bin/env node
// Sends a "what's due" push notification for assignments synced from
// Brightspace. Run each evening by .github/workflows/remind-assignments.yml.
// Needs VAPID_PRIVATE_KEY and PUSH_SUBSCRIPTION secrets — never commit either.

import fs from "node:fs/promises";
import webpush from "web-push";

const VAPID_PUBLIC_KEY =
  "BAhno-K_uLZDIIsxFDe_qrsSdDDiDxBuZF2cQNtrt8KiaSq6SoMOlQtoaQVPEeAR_iTtshChTxGmRH1rUPQG2iw";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const PUSH_SUBSCRIPTION = process.env.PUSH_SUBSCRIPTION;
const SCHOOL_TZ = "America/New_York";
const ASSIGNMENTS_PATH = new URL("../public/assignments.json", import.meta.url);

if (!VAPID_PRIVATE_KEY || !PUSH_SUBSCRIPTION) {
  console.error("VAPID_PRIVATE_KEY and PUSH_SUBSCRIPTION must both be set.");
  process.exit(1);
}

/** Wall clock in the school's timezone, so "tomorrow" matches the due dates. */
function schoolNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date());
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour === "24" ? "00" : map.hour}:${map.minute}`,
  };
}

function addDays(dateKey, n) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function formatTime(time) {
  if (!time) return "all day";
  const [h, m] = time.split(":");
  const h24 = Number(h);
  return `${h24 % 12 || 12}:${m} ${h24 >= 12 ? "PM" : "AM"}`;
}

async function main() {
  const assignments = JSON.parse(await fs.readFile(ASSIGNMENTS_PATH, "utf8"));
  const now = schoolNow();
  const tomorrow = addDays(now.date, 1);

  // Anything still ahead of us tonight, plus everything due tomorrow.
  const tonight = assignments.filter((a) => a.due === now.date && (a.time ?? "23:59") > now.time);
  const dueTomorrow = assignments.filter((a) => a.due === tomorrow);
  const items = [...tonight, ...dueTomorrow].sort((a, b) =>
    a.due === b.due ? (a.time ?? "").localeCompare(b.time ?? "") : a.due < b.due ? -1 : 1,
  );

  if (items.length === 0) {
    console.log(`Nothing due tonight or on ${tomorrow} — no notification sent.`);
    return;
  }

  const title =
    tonight.length > 0
      ? `${items.length} due tonight & tomorrow`
      : `${items.length} due tomorrow`;
  const shown = items.slice(0, 4);
  const lines = shown.map(
    (a) => `${a.due === now.date ? "Tonight" : formatTime(a.time)} — ${a.title}`,
  );
  if (items.length > shown.length) lines.push(`+${items.length - shown.length} more`);

  webpush.setVapidDetails("mailto:noreply@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const parsed = JSON.parse(PUSH_SUBSCRIPTION);
  const subscriptions = Array.isArray(parsed) ? parsed : [parsed];
  const payload = JSON.stringify({ title, body: lines.join("\n"), tag: "assignments-due" });

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      sent++;
    } catch (err) {
      // A 404/410 means that device unsubscribed; log it but don't fail the run.
      console.error(`Failed to send to one subscription: ${err.statusCode ?? ""} ${err.message}`);
    }
  }

  console.log(`${title}\n${lines.join("\n")}`);
  console.log(`Sent to ${sent}/${subscriptions.length} subscription(s).`);
  if (sent === 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
