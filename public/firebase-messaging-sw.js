self.addEventListener("push", (event) => {
  console.log(
    "[LRP][SW] push event:",
    event?.data ? event.data.text() : "(no data)",
  );
  event.waitUntil(
    (async () => {
      const data = event.data ? event.data.json() : {};
      const title =
        data?.notification?.title || data?.title || "Lake Ride Pros";
      const body =
        data?.notification?.body ||
        data?.body ||
        "You have a new notification.";
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
        const focusClockPage = async () => {
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

          const newClient = await self.clients.openWindow("/clock");
          if (newClient) {
            newClient.postMessage({ type: "SW_OPEN_TIME_CLOCK" });
          }
        };

        if (action === "clockout") {
          try {
            const response = await fetch("/api/clockout", {
              method: "POST",
              credentials: "include",
            });

            if (!response.ok) {
              let detail = "";
              try {
                detail = await response.text();
              } catch (readError) {
                console.warn(
                  "[LRP][SW] clockout response read failed",
                  readError,
                );
              }
              const detailSuffix = detail ? ` — ${detail}` : "";
              throw new Error(
                `Clock out failed: ${response.status} ${response.statusText}${detailSuffix}`,
              );
            }

            const persistent = await self.registration.getNotifications({
              tag: "lrp-timeclock",
            });
            for (const notification of persistent) {
              notification.close();
            }

            await self.registration.showNotification("Clocked Out ✅", {
              body: "Your shift has been ended.",
              tag: "lrp-timeclock-confirm",
              silent: true,
              icon: "/icons/icon-192.png",
            });

            await focusClockPage();
            return;
          } catch (clockoutError) {
            console.error("[LRP][SW] clockout request failed", clockoutError);

            await self.registration.showNotification("Clock Out Failed ❌", {
              body: "We couldn't confirm your clock out. Please retry from the clock page.",
              tag: "lrp-timeclock-error",
              icon: "/icons/icon-192.png",
            });

            await focusClockPage();
            return;
          }
        }

        await focusClockPage();
      } catch (err) {
        console.error("[LRP][SW] notificationclick failed", err);
      }
    })(),
  );
});
