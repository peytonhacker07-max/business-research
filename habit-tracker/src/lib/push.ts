// Push-notification helpers: register the service worker, request permission,
// and create a Web Push subscription. The subscription JSON is shown to the
// user to paste into a GitHub Actions secret (PUSH_SUBSCRIPTION), which the
// scheduled workflow uses to send the daily reminders.

// VAPID public key (safe to ship publicly). The matching private key lives
// only in the repo's GitHub Actions secret.
const VAPID_PUBLIC_KEY =
  "BIK_2z4tYsrVmpOMkQZRDB9uuNF9kIsDydhU2i3Cvulu8T27bGvM_e2SmSe0NPeS3zvsxMa9_H3XcG8zl804kWQ";

export function pushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Register the service worker (idempotent). Returns the registration. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const url = `${import.meta.env.BASE_URL}sw.js`;
  return navigator.serviceWorker.register(url);
}

/** Already subscribed on this device? Returns the subscription JSON if so. */
export async function getExistingSubscription(): Promise<string | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? JSON.stringify(sub.toJSON()) : null;
}

/**
 * Request permission and subscribe to push. Resolves with the subscription
 * JSON string (to paste into the GitHub secret), or throws with a reason.
 */
export async function enablePush(): Promise<string> {
  if (!pushSupported()) {
    throw new Error("This device or browser doesn't support push notifications.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      "Notifications were not allowed. Enable them for this app in your settings, then try again.",
    );
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }
  return JSON.stringify(sub.toJSON());
}

/** Show a one-off local notification so the user can confirm it works. */
export async function sendTestNotification(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification("Daily — Habit Tracker", {
    body: "Reminders are working! 🔥 You'll get nudges at your set times.",
    icon: `${import.meta.env.BASE_URL}icon-192.png`,
    tag: "daily-test",
  });
}
