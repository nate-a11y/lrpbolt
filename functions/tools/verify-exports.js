const path = require("path");

function loadExports() {
  const entry = path.join(__dirname, "..", "index.js");
   
  const mod = require(entry);
  return Object.keys(mod).sort();
}

const expectedExports = [
  "apiCalendarFetch",
  "apiCalendarFetchHttp",
  "dailyDropIfLiveRides",
  "dropDailyRidesNow",
  "ensureLiveRideOpen",
  "migrateIssueTickets",
  "notifyDriverOnClaimCreated",
  "notifyDriverOnClaimUpdated",
  "notifyQueueOnCreate",
  "scheduleDropDailyRides",
  "sendDailySms",
  "sendPortalNotificationV2",
  "slaSweep",
  "smsOnCreateV2",
  "ticketsOnWrite",
  "ticketsOnWriteV2",
].sort();

const allowedAliases = new Set([
  "calendarFetch",
  "ensureLiveOpen",
  "notifyQueue",
  "sendPortalNotification",
  "smsOnCreate",
]);

function main() {
  const have = loadExports();
  const missing = expectedExports.filter((name) => !have.includes(name));
  const extra = have.filter(
    (name) => !expectedExports.includes(name) && !allowedAliases.has(name),
  );

  const missingAliases = Array.from(allowedAliases).filter(
    (name) => !have.includes(name),
  );

  const payload = {
    have,
    expected: expectedExports,
    missing,
    extra,
    missingAliases,
  };
  console.log(JSON.stringify(payload, null, 2));

  if (missing.length) {
    console.error("\u274c Missing exports", missing);
    process.exitCode = 1;
    return;
  }

  if (extra.length) {
    console.error("\u274c Unexpected exports", extra);
    process.exitCode = 1;
    return;
  }

  if (missingAliases.length) {
    console.warn("\u26a0\ufe0f Missing legacy aliases", missingAliases);
  } else {
    console.log("\u2705 Exports OK");
  }
}

main();
