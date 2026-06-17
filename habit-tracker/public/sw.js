/* Service worker for Daily — handles incoming push notifications and taps.
   Lives at the site root so its scope covers the whole app. */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Daily", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Daily — Habit Tracker";
  const options = {
    body: data.body || "Time to check in on your habits.",
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: data.tag || "daily-reminder",
    renotify: true,
    data: { url: data.url || "./" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    (event.notification.data && event.notification.data.url) || "./",
    self.registration.scope,
  ).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Focus an existing window if the app is already open.
      for (const client of clientList) {
        if (client.url.startsWith(self.registration.scope) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
