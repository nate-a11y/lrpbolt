const path = require("path");

function loadExports() {
  const entry = path.join(__dirname, "..", "index.js");
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const mod = require(entry);
  return Object.keys(mod).sort();
}

const expectedExports = [
  "dailyDropIfLiveRides",
  "dropDailyRidesNow",
  "migrateIssueTickets",
  "notifyQueueOnCreate",
  "scheduleDropDailyRides",
  "sendDailySms",
  "sendPortalNotificationV2",
  "slaSweep",
  "smsOnCreateV2",
  "ticketsOnWrite",
  "ticketsOnWriteV2",
].sort();

function main() {
  const have = loadExports();
  const missing = expectedExports.filter((name) => !have.includes(name));
  const extra = have.filter((name) => !expectedExports.includes(name));

  const payload = { have, expected: expectedExports, missing, extra };
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

  console.log("\u2705 Exports OK");
}

main();
