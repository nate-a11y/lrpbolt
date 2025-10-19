/* LRP Cloud Functions v2 entry */
const logger = require("firebase-functions/logger");

function attach(exportName, modulePath, propertyName = exportName) {
  try {
    const mod = require(modulePath);
    const fn = propertyName ? mod[propertyName] : mod;
    if (typeof fn === "function") {
      exports[exportName] = fn;
    }
  } catch (error) {
    logger.info("Function module skipped", {
      exportName,
      modulePath,
      err: error && (error.stack || error.message || error),
    });
  }
}

attach("notifyQueueOnCreate", "./notifyQueue");
attach("ticketsOnWrite", "./ticketsOnWrite");
attach("ticketsOnWriteV2", "./ticketsV2", "ticketsOnWrite");
attach("slaSweep", "./ticketsV2", "slaSweep");
attach("smsOnCreateV2", "./smsOnCreateV2", "smsOnCreateV2");
attach(
  "sendPortalNotificationV2",
  "./sendPortalNotificationV2",
  "sendPortalNotificationV2",
);
attach("dailyDropIfLiveRides", "./schedules", "dailyDropIfLiveRides");
attach("sendDailySms", "./schedules", "sendDailySms");
attach("scheduleDropDailyRides", "./schedules", "scheduleDropDailyRides");

process.on("unhandledRejection", (err) => {
  logger.error("Unhandled rejection", err && (err.stack || err.message || err));
});
