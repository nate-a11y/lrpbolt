const path = require("path");

function loadExports() {
  const entry = path.join(__dirname, "..", "index.js");
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const mod = require(entry);
  return Object.keys(mod).sort();
}

const expectedCore = [
  "notifyQueueOnCreate",
  "ticketsOnWrite",
  "ticketsOnWriteV2",
  "slaSweep",
  "smsOnCreateV2",
  "sendPortalNotificationV2",
  "dailyDropIfLiveRides",
  "sendDailySms",
  "scheduleDropDailyRides",
];

const expectedCompat = [
  "notifyQueue",
  "smsOnCreate",
  "adminMigrate",
  "notifyDriverOnClaimCreated",
  "notifyDriverOnClaimUpdated",
  "ensureLiveRideOpen",
  "ticketsOnWrite-slaSweep",
  "apiCalendarFetch",
  "sendPortalNotification",
  "notifyQueue-notifyQueueOnCreate",
  "ticketsOnWrite-ticketsOnWrite",
  "adminMigrate-migrateIssueTickets",
  "dropDailyRidesNow",
];

function main() {
  const have = loadExports();
  const need = [...expectedCore, ...expectedCompat].sort();
  const missing = need.filter((name) => !have.includes(name));
  const extra = have.filter((name) => !need.includes(name));

  const payload = { have, need, missing, extra };
  console.log(JSON.stringify(payload, null, 2));

  if (missing.length) {
    console.error("\u274c Missing exports", missing);
    process.exitCode = 1;
    return;
  }

  console.log("\u2705 Exports OK");
}

main();
