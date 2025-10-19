/* Canonical v2 exports with legacy aliases. */
const { logger } = require("firebase-functions/v2");

function attach(name, path, exportName) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mod = require(path);
    const fn = exportName ? mod?.[exportName] : mod;
    if (typeof fn !== "function") {
      logger.warn(
        "functions.index.attach missing export",
        {
          name,
          path,
          exportName,
          found: typeof fn,
        },
      );
      return;
    }
    exports[name] = fn;
  } catch (error) {
    logger.warn(
      "functions.index.attach require failed",
      {
        name,
        path,
        exportName,
        err: error?.message || error,
      },
    );
  }
}

// Canonical v2 implementations
attach("notifyQueueOnCreate", "./notifyQueue", "notifyQueueOnCreate");
attach("ticketsOnWrite", "./ticketsOnWrite", "ticketsOnWrite");
attach("ticketsOnWriteV2", "./ticketsV2", "ticketsOnWrite");
attach("slaSweep", "./ticketsV2", "slaSweep");
attach("smsOnCreateV2", "./smsOnCreateV2", "smsOnCreateV2");
attach(
  "sendPortalNotificationV2",
  "./sendPortalNotificationV2",
  "sendPortalNotificationV2",
);
attach("apiCalendarFetch", "./calendarFetch", "apiCalendarFetch");
attach("apiCalendarFetchHttp", "./calendarFetch", "apiCalendarFetchHttp");
attach("ensureLiveRideOpen", "./ensureLiveOpen", "ensureLiveRideOpen");
attach("dailyDropIfLiveRides", "./schedules", "dailyDropIfLiveRides");
attach("sendDailySms", "./schedules", "sendDailySms");
attach(
  "scheduleDropDailyRides",
  "./schedules",
  "scheduleDropDailyRides",
);
attach("dropDailyRidesNow", "./src", "dropDailyRidesNow");
attach("migrateIssueTickets", "./adminMigrateIssueTickets", "migrateIssueTickets");
attach(
  "notifyDriverOnClaimCreated",
  "./notifyDriverOnClaim",
  "notifyDriverOnClaimCreated",
);
attach(
  "notifyDriverOnClaimUpdated",
  "./notifyDriverOnClaim",
  "notifyDriverOnClaimUpdated",
);

// Legacy aliases → canonical v2 implementations
attach("sendPortalNotification", "./sendPortalNotificationV2", "sendPortalNotificationV2");
attach("smsOnCreate", "./smsOnCreateV2", "smsOnCreateV2");
attach("notifyQueue", "./notifyQueue", "notifyQueueOnCreate");
attach("calendarFetch", "./calendarFetch", "apiCalendarFetch");
attach("ensureLiveOpen", "./ensureLiveOpen", "ensureLiveRideOpen");

process.on("unhandledRejection", (error) => {
  logger.error("functions.index.unhandledRejection", error?.message || error);
});
