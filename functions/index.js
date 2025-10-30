/* Canonical v2 exports with legacy aliases. */
const { logger } = require("firebase-functions/v2");
const { onCall: onCallHttps, HttpsError } = require("firebase-functions/v2/https");

const { admin } = require("./admin");

function attach(name, path, exportName) {
  try {
     
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
attach("sendPartnerInfoSMS", "./sendPartnerInfoSMS", "sendPartnerInfoSMS");
attach("smsHealth", "./smsHealth", "smsHealth");
attach("chatbotQuery", "./chatbotQuery", "chatbotQuery");
attach("chatbotConfig", "./chatbotQuery", "chatbotConfig");
attach("apiCalendarFetch", "./calendarFetch", "apiCalendarFetch");
attach("apiCalendarFetchHttp", "./calendarFetch", "apiCalendarFetchHttp");
attach("sendShuttleTicketEmail", "./sendShuttleTicketEmail", "sendShuttleTicketEmail");
attach("sendBulkTicketsEmail", "./sendBulkTicketsEmail", "sendBulkTicketsEmail");
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
attach("deleteUser", "./deleteUser", "deleteUser");

// Legacy aliases → canonical v2 implementations
// Removed problematic aliases that were causing Cloud Run deployment errors:
// - sendPortalNotification (use sendPortalNotificationV2 instead)
// - notifyQueue (use notifyQueueOnCreate instead)
attach("smsOnCreate", "./smsOnCreateV2", "smsOnCreateV2");
attach("calendarFetch", "./calendarFetch", "apiCalendarFetch");
attach("ensureLiveOpen", "./ensureLiveOpen", "ensureLiveRideOpen");

exports.seedImportantInfoOnce = onCallHttps(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 120,
    cors: true,
    enforceAppCheck: false,
  },
  async (req) => {
    const { auth } = req;

    // Verify authentication exists
    if (!auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    // Check admin access via custom claim OR Firestore role
    const hasAdminClaim = auth.token?.admin === true;
    const hasAdminRole = auth.token?.role === "admin";
    let isAdmin = hasAdminClaim || hasAdminRole;

    // If no admin access from token, check Firestore
    if (!isAdmin && auth.token?.email) {
      try {
        const db = admin.firestore();
        const lcEmail = auth.token.email.toLowerCase();

        // Check userAccess collection
        const userAccessDoc = await db.collection("userAccess").doc(lcEmail).get();
        if (userAccessDoc.exists && userAccessDoc.data()?.access === "admin") {
          isAdmin = true;
        }

        // If not found in userAccess, check users collection
        if (!isAdmin) {
          const userDoc = await db.collection("users").doc(auth.uid).get();
          if (userDoc.exists && userDoc.data()?.role === "admin") {
            isAdmin = true;
          }
        }
      } catch (error) {
        logger.warn("Error checking Firestore role for seedImportantInfoOnce", {
          uid: auth.uid,
          error: error.message,
        });
      }
    }

    if (!isAdmin) {
      throw new HttpsError("permission-denied", "Admin only.");
    }

    const db = admin.firestore();
    const existing = await db.collection("importantInfo").limit(1).get();
    if (!existing.empty) {
      throw new HttpsError(
        "failed-precondition",
        "Collection already has items.",
      );
    }

    const items = require("./importantInfo.seed.json");
    const now = admin.firestore.FieldValue.serverTimestamp();

    const batch = db.batch();
    items.forEach((item) => {
      const ref = db.collection("importantInfo").doc();
      batch.set(ref, {
        title: (item?.title || "Untitled").trim(),
        blurb: item?.blurb || null,
        details: item?.details || null,
        category: (item?.category || "General").trim(),
        phone: item?.phone || null,
        url: item?.url || null,
        smsTemplate: item?.smsTemplate || null,
        isActive: item?.isActive !== false,
        createdAt: now,
        updatedAt: now,
      });
    });
    await batch.commit();
    return { ok: true, count: items.length };
  },
);

process.on("unhandledRejection", (error) => {
  logger.error("functions.index.unhandledRejection", error?.message || error);
});
