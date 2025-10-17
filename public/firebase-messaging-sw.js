/* global self, clients */
self.addEventListener("push", (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const notification = data.notification || {};
    const title = notification.title || "Lake Ride Pros";
    event.waitUntil(
      self.registration.showNotification(title, notification),
    );
  } catch (error) {
    void error;
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/notifications"));
});
