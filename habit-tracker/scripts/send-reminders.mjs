#!/usr/bin/env node
// Sends a "what's due" push notification for assignments synced from
// Brightspace. Run each evening by .github/workflows/remind-assignments.yml.
// Needs VAPID_PRIVATE_KEY and PUSH_SUBSCRIPTION secrets — never commit either.

import fs from "node:fs/promises";
import webpush from "web-push";
import { readAssignments } from "./lib/assignments-crypto.mjs";

const VAPID_PUBLIC_KEY =
  "BAhno-K_uLZDIIsxFDe_qrsSdDDiDxBuZF2cQNtrt8KiaSq6SoMOlQtoaQVPEeAR_iTtshChTxGmRH1rUPQG2iw";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const PUSH_SUBSCRIPTION = process.env.PUSH_SUBSCRIPTION;
const SCHOOL_TZ = "America/New_York";
const ASSIGNMENTS_PATH = new URL("../public/assignments.json", import.meta.url);
const QUOTES_PATH = new URL("../public/quotes.json", import.meta.url);
const STATE_PATH = new URL("../../.github/reminder-state.json", import.meta.url);

// Which Eastern hours count as each send. Wide, because GitHub delivers runs
// hours behind schedule — a narrow target would simply be missed.
const MORNING = { slot: "morning", from: 8, to: 12 };
const EVENING = { slot: "evening", from: 20, to: 24 };

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

/**
 * The quote for a date. Mirrors quoteIndexFor() in src/lib/quotes.ts so the
 * notification and the app show the same one on any given day.
 */
async function quoteFor(dateKey) {
  try {
    const quotes = JSON.parse(await fs.readFile(QUOTES_PATH, "utf8"));
    if (!Array.isArray(quotes) || quotes.length === 0) return null;
    const [y, m, d] = dateKey.split("-").map(Number);
    const days = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
    const i = ((days % quotes.length) + quotes.length) % quotes.length;
    return quotes[i];
  } catch {
    return null;
  }
}

/** What has already been sent today, by window. Missing or unreadable is fine. */
async function readState() {
  try {
    const parsed = JSON.parse(await fs.readFile(STATE_PATH, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function formatTime(time) {
  if (!time) return "all day";
  const [h, m] = time.split(":");
  const h24 = Number(h);
  return `${h24 % 12 || 12}:${m} ${h24 >= 12 ? "PM" : "AM"}`;
}

/**
 * Reads the subscription secret. It's pasted in by hand, so tolerate the
 * usual mishaps — surrounding whitespace, a stray trailing character, or the
 * same code pasted twice — instead of failing the whole run.
 */
function parseSubscriptions(raw) {
  const text = raw.trim();
  const found = [];
  try {
    const direct = JSON.parse(text);
    found.push(...(Array.isArray(direct) ? direct : [direct]));
  } catch {
    // Pull out each complete top-level {...} block. Endpoints are URLs and
    // keys are base64, so neither contains braces to confuse the scan.
    let depth = 0;
    let start = -1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (text[i] === "}" && depth > 0) {
        depth--;
        if (depth === 0) {
          try {
            found.push(JSON.parse(text.slice(start, i + 1)));
          } catch {
            /* not a valid object — skip it */
          }
        }
      }
    }
  }

  const byEndpoint = new Map();
  for (const sub of found) {
    if (sub?.endpoint && sub?.keys) byEndpoint.set(sub.endpoint, sub);
  }
  return [...byEndpoint.values()];
}

async function main() {
  const assignments = readAssignments(
    JSON.parse(await fs.readFile(ASSIGNMENTS_PATH, "utf8")),
    process.env.ASSIGNMENTS_PASSPHRASE,
  );
  const now = schoolNow();
  const tomorrow = addDays(now.date, 1);

  const hour = now.time.slice(0, 2);
  const hourNum = Number(hour);
  const manual = process.env.GITHUB_EVENT_NAME !== "schedule";

  // A scheduled run sends only if it landed inside a window and nothing has
  // gone out for that window today; a manual run always sends.
  const window = [MORNING, EVENING].find((w) => hourNum >= w.from && hourNum < w.to);
  let state = {};
  if (!manual) {
    if (!window) {
      console.log(`Landed at ${now.time} Eastern, outside both windows — nothing to do.`);
      return;
    }
    state = await readState();
    if (state[window.slot] === now.date) {
      console.log(`The ${window.slot} reminder already went out on ${now.date} — nothing to do.`);
      return;
    }
    console.log(`Landed at ${now.time} Eastern — sending the ${window.slot} reminder.`);
  }

  const isMorning = window ? window.slot === "morning" : hourNum < 12;

  // Count anything due from the top of the current hour onward. Comparing
  // against the hour rather than the exact minute keeps the 9:00 AM reading
  // quizzes in the morning send, while the evening one drops what has
  // already come and gone that day.
  const fromHour = `${hour}:00`;
  const dueToday = assignments.filter((a) => a.due === now.date && (a.time ?? "23:59") >= fromHour);
  const dueTomorrow = assignments.filter((a) => a.due === tomorrow);
  const items = [...dueToday, ...dueTomorrow].sort((a, b) =>
    a.due === b.due ? (a.time ?? "").localeCompare(b.time ?? "") : a.due < b.due ? -1 : 1,
  );

  // The habit nudge goes out every day regardless of coursework, so this
  // reminder always sends — it never stays silent the way it used to.
  const HABIT_NUDGE = isMorning
    ? "Don't forget to track your habits throughout the day, Boss"
    : "Don't forget to log your habits before bed, Boss";

  let title;
  const lines = [];

  if (items.length === 0) {
    title = "Nothing due today";
  } else {
    title =
      dueToday.length > 0 && dueTomorrow.length > 0
        ? `${items.length} due today & tomorrow`
        : dueToday.length > 0
          ? `${dueToday.length} due today`
          : `${dueTomorrow.length} due tomorrow`;

    const shown = items.slice(0, 4);
    for (const a of shown) {
      const when = formatTime(a.time);
      lines.push(a.due === now.date ? `${when} — ${a.title}` : `Tomorrow ${when} — ${a.title}`);
    }
    if (items.length > shown.length) lines.push(`+${items.length - shown.length} more`);
  }

  lines.push(HABIT_NUDGE);

  // A quote to start the day — morning only, so the evening nudge stays short.
  if (isMorning) {
    const quote = await quoteFor(now.date);
    if (quote) lines.push(`"${quote.text}" — ${quote.author}`);
  }

  // Apple's push service validates the VAPID subject and rejects placeholder
  // contacts, so point it at the app itself.
  webpush.setVapidDetails(
    "https://peytonhacker07-max.github.io/business-research/",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );

  const subscriptions = parseSubscriptions(PUSH_SUBSCRIPTION);
  if (subscriptions.length === 0) {
    const raw = PUSH_SUBSCRIPTION.trim();
    console.error(
      "PUSH_SUBSCRIPTION didn't contain a usable subscription. It should be the " +
        'code copied from the app\'s reminders dialog, starting with {"endpoint":.',
    );
    // Enough shape to tell "empty", "wrong value pasted" and "truncated copy"
    // apart, without printing the endpoint itself.
    console.error(
      `Got ${raw.length} characters, starting "${raw.slice(0, 12)}"` +
        `, ${raw.includes('"endpoint"') ? "contains" : "missing"} an "endpoint" field` +
        `, ${raw.includes('"keys"') ? "contains" : "missing"} a "keys" field.`,
    );
    process.exit(1);
  }
  const payload = JSON.stringify({ title, body: lines.join("\n"), tag: "assignments-due" });

  let sent = 0;
  for (const sub of subscriptions) {
    // Only the host — the full endpoint is effectively a credential.
    const service = (() => {
      try {
        return new URL(sub.endpoint).host;
      } catch {
        return "unknown";
      }
    })();
    try {
      const result = await webpush.sendNotification(sub, payload);
      console.log(`${service} accepted the push (HTTP ${result.statusCode}).`);
      sent++;
    } catch (err) {
      // The push service explains itself in the body — without it a bare
      // status code says nothing about which of many causes it was.
      console.error(
        `Failed to send: ${err.statusCode ?? "?"} ${err.message}\n${err.body ?? "(no body)"}`,
      );
      if (err.statusCode === 400 || err.statusCode === 403) {
        console.error(
          "That usually means the subscription was created with a different " +
            "VAPID key — re-subscribe in the app and update PUSH_SUBSCRIPTION.",
        );
      }
    }
  }

  console.log(`${title}\n${lines.join("\n")}`);
  console.log(`Sent to ${sent}/${subscriptions.length} subscription(s).`);
  if (sent === 0) process.exit(1);

  // Only recorded once a device has actually accepted it, so a failed send
  // doesn't stop a later run from trying again.
  if (!manual && window) {
    state[window.slot] = now.date;
    await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
    console.log(`Recorded the ${window.slot} reminder for ${now.date}.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
