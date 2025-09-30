self.addEventListener("push", (event) => {
  console.log("[LRP][SW] push event:", event?.data ? event.data.text() : "(no data)");
  event.waitUntil(
    (async () => {
      const data = event.data ? event.data.json() : {};
      const title = data?.notification?.title || data?.title || "Lake Ride Pros";
      const body = data?.notification?.body || data?.body || "You have a new notification.";
      const icon = "/icons/icon-192.png";
      const badge = "/icons/icon-192.png";
      await self.registration.showNotification(title, {
        body,
        icon,
        badge,
        data,
        vibrate: [100, 50, 100],
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  const { action } = event;
  event.notification.close();
  if (action === "clockout") {
    event.waitUntil(
      (async () => {
        const allClients = await self.clients.matchAll({ includeUncontrolled: true });
        for (const client of allClients) {
          client.postMessage({ type: "SW_CLOCK_OUT_REQUEST" });
        }
      })(),
    );
    return;
  }

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (allClients.length) {
        const [client] = allClients;
        await client.focus();
        client.postMessage({ type: "SW_OPEN_TIME_CLOCK" });
        return;
      }
    })(),
  );
});
