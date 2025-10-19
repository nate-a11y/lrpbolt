/* LRP Cloud Functions v2 entry (modular, with precise compat shims) */

function attach(exportName, modulePath, symbol) {
  try {
    const mod = require(modulePath);
    if (mod && mod[symbol]) {
      exports[exportName] = mod[symbol];
      return;
    }
    // eslint-disable-next-line no-console
    console.warn(`Compat attach failed: ${exportName} ← ${modulePath}.${symbol} (missing symbol)`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`Compat attach failed: ${exportName} ← ${modulePath}.${symbol}`, e && (e.message || e));
  }
}

// ---- Core v2 exports (native new names) ----
attach("notifyQueueOnCreate", "./notifyQueue", "notifyQueueOnCreate");
attach("ticketsOnWrite", "./ticketsOnWrite", "ticketsOnWrite");
attach("ticketsOnWriteV2", "./ticketsV2", "ticketsOnWrite");
attach("slaSweep", "./ticketsV2", "slaSweep");
attach("smsOnCreateV2", "./smsOnCreateV2", "smsOnCreateV2");
attach("sendPortalNotificationV2", "./sendPortalNotificationV2", "sendPortalNotificationV2");
attach("dailyDropIfLiveRides", "./schedules", "dailyDropIfLiveRides");
attach("sendDailySms", "./schedules", "sendDailySms");
attach("scheduleDropDailyRides", "./schedules", "scheduleDropDailyRides");

// ---- Back-compat generic aliases (old simple names) ----
attach("notifyQueue", "./notifyQueue", "notifyQueueOnCreate");
attach("smsOnCreate", "./smsOnCreateV2", "smsOnCreateV2");
attach("adminMigrate", "./adminMigrateIssueTickets", "migrateIssueTickets");

// ---- Deployed legacy names reported by Firebase (map 1:1 to v2 targets) ----
attach("notifyDriverOnClaimCreated", "./ticketsOnWrite", "ticketsOnWrite");
attach("notifyDriverOnClaimUpdated", "./ticketsOnWrite", "ticketsOnWrite");
attach("ensureLiveRideOpen", "./ensureLiveOpen", "ensureLiveRideOpen");
attach("ticketsOnWrite-slaSweep", "./ticketsV2", "slaSweep");
attach("apiCalendarFetch", "./sendPortalNotificationV2", "sendPortalNotificationV2");
attach("sendPortalNotification", "./sendPortalNotificationV2", "sendPortalNotificationV2");
attach("notifyQueue-notifyQueueOnCreate", "./notifyQueue", "notifyQueueOnCreate");
attach("smsOnCreate", "./smsOnCreateV2", "smsOnCreateV2");
attach("ticketsOnWrite-ticketsOnWrite", "./ticketsOnWrite", "ticketsOnWrite");
attach("adminMigrate-migrateIssueTickets", "./adminMigrateIssueTickets", "migrateIssueTickets");
attach("dropDailyRidesNow", "./schedules", "scheduleDropDailyRides");

process.on("unhandledRejection", (err) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled rejection", err);
});
