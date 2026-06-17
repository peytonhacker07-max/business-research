// Sends the daily habit reminders via Web Push.
//
// Run on a schedule by .github/workflows/notify.yml. The workflow fires at the
// UTC times covering both CDT and CST, and this script gates on the actual
// America/Chicago hour so it (a) sends exactly once per reminder and
// (b) stays correct across daylight-saving changes automatically.
//
// Required env (GitHub Actions secrets):
//   VAPID_PRIVATE_KEY  — private VAPID key (matches the public key in the app)
//   PUSH_SUBSCRIPTION  — the subscription JSON copied from the app
//                        (a single object, or a JSON array of them)

import webpush from "web-push";

const VAPID_PUBLIC_KEY =
  "BIK_2z4tYsrVmpOMkQZRDB9uuNF9kIsDydhU2i3Cvulu8T27bGvM_e2SmSe0NPeS3zvsxMa9_H3XcG8zl804kWQ";
const VAPID_SUBJECT = "https://peytonhacker07-max.github.io/business-research/";

const TIMEZONE = "America/Chicago";

// Reminder copy keyed by the local hour it should fire at.
const MESSAGES = {
  8: {
    title: "Good morning ☀️",
    body: "Plan your habits for today — small steps, big streaks.",
    tag: "daily-morning",
  },
  13: {
    title: "Midday check-in ✅",
    body: "How are your habits going? Knock a few out now.",
    tag: "daily-midday",
  },
  21: {
    title: "Before bed 🔥",
    body: "Check off today's habits and keep your streak alive.",
    tag: "daily-evening",
  },
};

function currentHourInTimezone(tz) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  // "24" can appear for midnight in some environments — normalize to 0.
  return Number(hour) % 24;
}

function loadSubscriptions() {
  const raw = process.env.PUSH_SUBSCRIPTION;
  if (!raw) throw new Error("PUSH_SUBSCRIPTION secret is not set.");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function main() {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) throw new Error("VAPID_PRIVATE_KEY secret is not set.");

  // Manual test run (workflow_dispatch with test=true) sends immediately,
  // bypassing the time gate, so reminders can be verified end-to-end.
  const forceTest = process.env.FORCE_TEST === "true";

  const hour = currentHourInTimezone(TIMEZONE);
  const message = forceTest
    ? {
        title: "Test reminder 🔔",
        body: "Your daily reminders are set up and working!",
        tag: "daily-test",
      }
    : MESSAGES[hour];

  if (!message) {
    console.log(
      `Local time in ${TIMEZONE} is hour ${hour}; no reminder scheduled. Exiting.`,
    );
    return;
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, privateKey);

  const subscriptions = loadSubscriptions();
  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    tag: message.tag,
    url: "./",
  });

  let ok = 0;
  let gone = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      ok++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        gone++;
        console.warn("Subscription expired/gone (re-enable in the app to refresh).");
      } else {
        console.error("Failed to send to a subscription:", err.statusCode, err.body);
      }
    }
  }

  console.log(
    `Sent "${message.title}" for hour ${hour}: ${ok} delivered, ${gone} expired.`,
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
