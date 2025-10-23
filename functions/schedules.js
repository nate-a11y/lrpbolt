const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");

const { admin } = require("./_admin");
const { dropDailyFromQueue } = require("./src/jobs/dropDailyFromQueue");

const REGION = "us-central1";
const TIME_ZONE = "America/Chicago";
const db = admin.firestore();

async function writeDropResult(stats, trigger) {
  await db.doc("AdminMeta/lastDropDaily").set(
    {
      ranAt: admin.firestore.FieldValue.serverTimestamp(),
      stats,
      trigger,
      v: 2,
    },
    { merge: true },
  );
}

async function shouldRunDailyDrop() {
  const cfgSnap = await db.doc("AdminMeta/config").get();
  if (!cfgSnap.exists) {
    return true;
  }

  const cfg = cfgSnap.data();
  if (cfg.dropEnabled === false) {
    return false;
  }

  return true;
}

async function notifyRidesAvailable(stats) {
  try {
    // Get all FCM tokens to notify all users
    const tokensSnap = await db.collection("fcmTokens").get();
    const targets = [];
    const dedupTokens = new Set();

    tokensSnap.forEach((doc) => {
      const tokenId = doc.id;
      if (tokenId && !dedupTokens.has(tokenId)) {
        dedupTokens.add(tokenId);
        targets.push({ type: "fcm", to: tokenId });
      }
    });

    if (targets.length === 0) {
      logger.info("notifyRidesAvailable: no FCM tokens found");
      return;
    }

    const totalRides = stats.imported + stats.updatedExisting;
    const title = "New Rides Available";
    const body = `${totalRides} ride${totalRides > 1 ? "s" : ""} available to claim`;

    await db.collection("notifyQueue").add({
      targets,
      context: {
        ticket: { title, description: body },
        link: "/",
      },
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info("notifyRidesAvailable: queued", {
      targets: targets.length,
      rides: totalRides,
    });
  } catch (error) {
    logger.error("notifyRidesAvailable failed", {
      err: error && (error.stack || error.message || error),
    });
  }
}

async function runDropDaily(trigger) {
  if (!(await shouldRunDailyDrop())) {
    logger.info("dropDailyRides skipped by config", { trigger });
    return;
  }

  try {
    const stats = await dropDailyFromQueue({ dryRun: false });
    await writeDropResult(stats, trigger);
    logger.info("dropDailyRides complete", { trigger, stats });

    // Send notification if rides were imported
    if (stats.imported > 0 || stats.updatedExisting > 0) {
      await notifyRidesAvailable(stats);
    }
  } catch (error) {
    logger.error("dropDailyRides failed", {
      trigger,
      err: error && (error.stack || error.message || error),
    });
  }
}

const dailyDropIfLiveRides = onSchedule(
  { region: REGION, schedule: "0 12 * * *", timeZone: TIME_ZONE },
  async () => {
    try {
      const liveSnapshot = await db.collection("liveRides").limit(1).get();
      if (liveSnapshot.empty) {
        logger.info("dailyDropIfLiveRides skipped", { reason: "no-live-rides" });
        return;
      }
      await runDropDaily("conditional-schedule");
    } catch (error) {
      logger.error("dailyDropIfLiveRides error", error && (error.stack || error.message || error));
    }
  },
);

const sendDailySms = onSchedule(
  { region: REGION, schedule: "0 14 * * *", timeZone: TIME_ZONE },
  async () => {
    try {
      const configSnap = await db.doc("AdminMeta/dailySmsConfig").get();
      const config = configSnap.exists ? configSnap.data() : {};
      const enabled = config?.enabled !== false;
      const recipients = Array.isArray(config?.recipients)
        ? config.recipients.filter(Boolean)
        : config?.to
        ? [config.to]
        : [];

      if (!enabled || recipients.length === 0) {
        logger.info("sendDailySms skipped", { enabled, recipients: recipients.length });
        return;
      }

      const body = config?.body || "Daily LRP check-in";
      const batch = db.batch();
      const collectionRef = db.collection("outboundMessages");

      recipients.forEach((to) => {
        const docRef = collectionRef.doc();
        batch.set(docRef, {
          to,
          body,
          status: "queued",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          metadata: { trigger: "daily-sms" },
        });
      });

      await batch.commit();
      logger.info("sendDailySms queued", { count: recipients.length });
    } catch (error) {
      logger.error("sendDailySms error", error && (error.stack || error.message || error));
    }
  },
);

const scheduleDropDailyRides = onSchedule(
  { region: REGION, schedule: "0 20 * * *", timeZone: TIME_ZONE },
  async () => {
    await runDropDaily("evening-schedule");
  },
);

module.exports = {
  dailyDropIfLiveRides,
  sendDailySms,
  scheduleDropDailyRides,
};
