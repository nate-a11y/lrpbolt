const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger, setGlobalOptions } = require("firebase-functions/v2");
const { admin } = require("./_admin");
const { sendAllTargets } = require("./notifyQueue");

if (!global.__lrpGlobalOptionsSet) {
  try {
    setGlobalOptions({ region: "us-central1", cpu: 1 });
    global.__lrpGlobalOptionsSet = true;
  } catch (error) {
    logger.warn("ticketsOnWrite:setGlobalOptions", error?.message || error);
  }
}

exports.ticketsOnWrite = onDocumentWritten(
  "tickets/{id}",
  async (event) => {
    if (!event?.data) {
      return;
    }

    const beforeExists = event.data.before.exists;
    const afterExists = event.data.after.exists;

    if (!afterExists) {
      return;
    }

    const beforeData = beforeExists ? event.data.before.data() : null;
    const afterData = event.data.after.data();

    if (!afterData) {
      return;
    }

    const statusChanged = JSON.stringify(beforeData?.status) !== JSON.stringify(afterData.status);
    if (!statusChanged) {
      return;
    }

    const db = admin.firestore();
    const ticketId = event.params?.id;
    const link = ticketId
      ? `https://lakeridepros.xyz/#/tickets?id=${ticketId}`
      : undefined;

    const ticketPayload = {
      id: ticketId,
      title: afterData.title,
      description: afterData.description,
      status: afterData.status,
      category: afterData.category,
    };

    const userIds = new Set(
      [afterData?.createdBy?.userId, afterData?.assignee?.userId].filter(Boolean),
    );

    const targets = [];

    await Promise.all(
      Array.from(userIds).map(async (userId) => {
        try {
          const snapshot = await db.doc(`userAccess/${userId}`).get();
          if (!snapshot.exists) {
            return;
          }
          const user = snapshot.data();
          if (user?.email) {
            targets.push({ type: "email", to: user.email });
          }
        } catch (error) {
          logger.error("ticketsOnWrite:userLookup", {
            userId,
            err: error && (error.stack || error.message || error),
          });
        }
      }),
    );

    if (!targets.length) {
      return;
    }

    try {
      await sendAllTargets(targets, ticketPayload, link);
    } catch (error) {
      logger.error("ticketsOnWrite:notify", error?.message || error);
      throw error;
    }
  },
);
