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
  event.waitUntil(
    (async () => {
      try {
        if (action === "clockout") {
          await fetch("/api/clockout", {
            method: "POST",
            credentials: "include",
          });

          const persistent = await self.registration.getNotifications({ tag: "lrp-timeclock" });
          for (const notification of persistent) {
            notification.close();
          }

          await self.registration.showNotification("Clocked Out ✅", {
            body: "Your shift has been ended.",
            tag: "lrp-timeclock-confirm",
            silent: true,
            icon: "/icons/icon-192.png",
          });

          const allClients = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
          });
          if (allClients.length) {
            const [primary, ...others] = allClients;
            await primary.focus();
            primary.postMessage({ type: "SW_OPEN_TIME_CLOCK" });
            for (const client of others) {
              client.postMessage({ type: "SW_OPEN_TIME_CLOCK" });
            }
          } else {
            const newClient = await self.clients.openWindow("/clock");
            if (newClient) {
              newClient.postMessage({ type: "SW_OPEN_TIME_CLOCK" });
            }
          }
          return;
        }

        const allClients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        if (allClients.length) {
          const [primary, ...others] = allClients;
          await primary.focus();
          primary.postMessage({ type: "SW_OPEN_TIME_CLOCK" });
          for (const client of others) {
            client.postMessage({ type: "SW_OPEN_TIME_CLOCK" });
          }
          return;
        }

        await self.clients.openWindow("/clock");
      } catch (err) {
        console.error("[LRP][SW] notificationclick failed", err);
      }
    })(),
  );
});
