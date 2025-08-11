/* Proprietary and confidential. See LICENSE. */
// functions/index.js

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./src/admin.js";
import { normalizeHeader, logClaimFailure } from "./utils.js";
import { COLLECTIONS } from "./constants.js";

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const CALL_OPTS = {
  region: "us-central1",
  memory: "256MiB",
  timeoutSeconds: 120,
  concurrency: 80,
  minInstances: 0,
};

async function getUser(request) {
  const { auth } = request;
  if (!auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  const email = (auth.token.email || "").toLowerCase();
  const doc = await db.collection(COLLECTIONS.USER_ACCESS).doc(email).get();
  if (!doc.exists) {
    throw new HttpsError("permission-denied", "User not authorized");
  }
  return { email, ...doc.data() };
}

async function requireAdmin(request) {
  const user = await getUser(request);
  if (user.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only");
  }
  return user;
}

export const getRidesV2 = onCall(CALL_OPTS, async (request) => {
  await getUser(request);
  const snap = await db.collection(COLLECTIONS.LIVE_RIDES).get();
  const rides = snap.docs
    .filter((d) => !d.data().claimedBy)
    .map((doc) => ({ id: doc.id, ...doc.data() }));
  return { success: true, rides };
});

export const getRideQueueV2 = onCall(CALL_OPTS, async (request) => {
  await requireAdmin(request);
  const snap = await db.collection(COLLECTIONS.RIDE_QUEUE).get();
  const rides = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return { success: true, rides };
});

export const getClaimedRidesV2 = onCall(CALL_OPTS, async (request) => {
  const user = await getUser(request);
  const snap = await db.collection(COLLECTIONS.LIVE_RIDES).get();
  let rides = snap.docs.filter((d) => d.data().claimedBy);
  if (user.role !== "admin") {
    rides = rides.filter((d) => d.data().claimedBy === user.email);
  }
  rides = rides.map((doc) => ({ id: doc.id, ...doc.data() }));
  return { success: true, rides };
});

export const claimRideV2 = onCall(CALL_OPTS, async (request) => {
  const { data } = request;
  const user = await getUser(request);
  const { tripId, driverName } = data || {};
  if (!tripId) return { success: false, message: "tripId required" };

  try {
    await db.runTransaction(async (tx) => {
      const q = await tx.get(
        db
          .collection(COLLECTIONS.LIVE_RIDES)
          .where("tripId", "==", tripId)
          .limit(1)
      );
      if (q.empty) {
        throw new HttpsError("not-found", "Ride not found");
      }

      const docSnap = q.docs[0];
      const ref = docSnap.ref;
      const ride = docSnap.data();

      if (ride.claimedBy) {
        await logClaimFailure(tripId, user.email, "Ride already claimed");
        throw new HttpsError("failed-precondition", "Ride already claimed");
      }

      tx.update(ref, {
        claimedBy: driverName || user.email,
        claimedAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true };
  } catch (err) {
    if (err instanceof HttpsError) {
      return { success: false, message: err.message };
    }
    logger.error("[claimRide] unexpected error", err);
    return { success: false, message: "Unexpected error" };
  }
});


export const addRideToQueueV2 = onCall(CALL_OPTS, async (request) => {
  await requireAdmin(request);
  const { ride = {} } = request.data || {};
  if (!ride.tripId) {
    return { success: false, message: "tripId required" };
  }
  await db
    .collection(COLLECTIONS.RIDE_QUEUE)
    .doc(ride.tripId.toString())
    .set(ride);
  return { success: true };
});

export const updateRideV2 = onCall(CALL_OPTS, async (request) => {
  await requireAdmin(request);
  const { tripId, fields } = request.data || {};
  if (!tripId || !fields) {
    return { success: false, message: "tripId and fields required" };
  }
  const updates = {};
  for (const [k, v] of Object.entries(fields)) {
    updates[normalizeHeader(k)] = v;
  }
  await db
    .collection(COLLECTIONS.RIDE_QUEUE)
    .doc(tripId.toString())
    .update(updates);
  return { success: true };
});

export const deleteRideV2 = onCall(CALL_OPTS, async (request) => {
  await requireAdmin(request);
  const { tripId } = request.data || {};
  if (!tripId) {
    return { success: false, message: "tripId required" };
  }
  await db
    .collection(COLLECTIONS.RIDE_QUEUE)
    .doc(tripId.toString())
    .delete();
  return { success: true };
});


export const getTicketByIdV2 = onCall(CALL_OPTS, async (request) => {
  await getUser(request);
  const { ticketId } = request.data || {};
  const doc = await db.collection(COLLECTIONS.TICKETS).doc(ticketId).get();
  if (!doc.exists) {
    return { success: false, message: "Ticket not found" };
  }
  return { success: true, ticket: { id: doc.id, ...doc.data() } };
});

export const getAllTicketsV2 = onCall(CALL_OPTS, async (request) => {
  await requireAdmin(request);
  const snap = await db.collection(COLLECTIONS.TICKETS).get();
  const tickets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return { success: true, tickets };
});

export const addTicketV2 = onCall(CALL_OPTS, async (request) => {
  await requireAdmin(request);
  const { ticket = {} } = request.data || {};
  if (!ticket.ticketId) {
    return { success: false, message: "ticketId required" };
  }
  ticket.createdAt = FieldValue.serverTimestamp();
  await db
    .collection(COLLECTIONS.TICKETS)
    .doc(ticket.ticketId.toString())
    .set(ticket);
  return { success: true };
});

export const updateTicketFieldsV2 = onCall(CALL_OPTS, async (request) => {
  await requireAdmin(request);
  const { ticketId, fields } = request.data || {};
  if (!ticketId || !fields) {
    return { success: false, message: "ticketId and fields required" };
  }
  const updates = {};
  for (const [k, v] of Object.entries(fields)) {
    updates[normalizeHeader(k)] = v;
  }
  await db.collection(COLLECTIONS.TICKETS).doc(ticketId.toString()).update(updates);
  return { success: true };
});

export const deleteTicketV2 = onCall(CALL_OPTS, async (request) => {
  await requireAdmin(request);
  const { ticketId } = request.data || {};
  if (!ticketId) {
    return { success: false, message: "ticketId required" };
  }
  await db.collection(COLLECTIONS.TICKETS).doc(ticketId.toString()).delete();
  return { success: true };
});

export const updateTicketScanStatusV2 = onCall(CALL_OPTS, async (request) => {
  await getUser(request);
  const { ticketId, scanType, driverName } = request.data || {};
  if (!ticketId || !scanType) {
    return { success: false, message: "ticketId and scanType required" };
  }
  const update = {};
  const name = driverName || request.auth?.token?.email || "Unknown";
  if (scanType === "outbound") {
    update.scannedOutbound = true;
    update.scannedOutboundAt = FieldValue.serverTimestamp();
    update.scannedOutboundBy = name;
  } else if (scanType === "return") {
    update.scannedReturn = true;
    update.scannedReturnAt = FieldValue.serverTimestamp();
    update.scannedReturnBy = name;
  } else {
    return { success: false, message: "Invalid scanType" };
  }
  await db.collection(COLLECTIONS.TICKETS).doc(ticketId.toString()).update(update);
  return { success: true };
});

export const sendTicketEmailV2 = onCall(CALL_OPTS, async (request) => {
  await requireAdmin(request);
  const { to, subject, body, attachment, filename } = request.data || {};
  if (!to || !subject || !attachment) {
    return { success: false, message: "Missing fields" };
  }
  const mailRef = db.collection("_mail").doc();
  await mailRef.set({
    to: Array.isArray(to) ? to : [to],
    cc: ["contactus@lakeridepros.com"],
    message: {
      subject,
      text: body || "",
      attachments: [
        {
          filename: filename || "ticket.png",
          content: attachment,
          encoding: "base64",
        },
      ],
    },
  });
  return { success: true };
});

export const logTimeEntryV2 = onCall(CALL_OPTS, async (request) => {
  const user = await getUser(request);
  const { driver, rideId, startTime, endTime, duration } = request.data || {};
  await db.collection(COLLECTIONS.TIME_LOGS).add({
    driver: driver || user.email,
    rideId: rideId || null,
    startTime,
    endTime,
    duration,
    loggedAt: FieldValue.serverTimestamp(),
  });
  return { success: true };
});

export { dropDailyRidesNowV2, dropDailyRidesDailyV2 } from "./src/dropDailyRidesNow.js";

