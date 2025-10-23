/* global self, clients */
self.addEventListener("push", (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const notification = data.notification || {};
    const title = notification.title || "Lake Ride Pros";
    const body = notification.body || "";
    const icon = notification.icon || data.data?.icon;
    const url = data.data?.url || "/notifications";

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon,
        data: { url, ...(data.data || {}) },
      }),
    );
  } catch (error) {
    void error;
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/notifications";
  event.waitUntil(clients.openWindow(url));
});
