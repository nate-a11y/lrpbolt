/* LRP Cloud Functions v2 entry (native exports only) */

const { notifyQueueOnCreate } = require("./notifyQueue");
const { ticketsOnWrite } = require("./ticketsOnWrite");
const { ticketsOnWrite: ticketsOnWriteV2, slaSweep } = require("./ticketsV2");
const { smsOnCreateV2 } = require("./smsOnCreateV2");
const { sendPortalNotificationV2 } = require("./sendPortalNotificationV2");
const {
  dailyDropIfLiveRides,
  sendDailySms,
  scheduleDropDailyRides,
} = require("./schedules");
const { dropDailyRidesNow } = require("./src");
const { migrateIssueTickets } = require("./adminMigrateIssueTickets");

exports.notifyQueueOnCreate = notifyQueueOnCreate;
exports.ticketsOnWrite = ticketsOnWrite;
exports.ticketsOnWriteV2 = ticketsOnWriteV2;
exports.slaSweep = slaSweep;
exports.smsOnCreateV2 = smsOnCreateV2;
exports.sendPortalNotificationV2 = sendPortalNotificationV2;
exports.dailyDropIfLiveRides = dailyDropIfLiveRides;
exports.sendDailySms = sendDailySms;
exports.scheduleDropDailyRides = scheduleDropDailyRides;
exports.dropDailyRidesNow = dropDailyRidesNow;
exports.migrateIssueTickets = migrateIssueTickets;

process.on("unhandledRejection", (err) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled rejection", err);
});
