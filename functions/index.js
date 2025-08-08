/* Proprietary and confidential. See LICENSE. */
// functions/index.js

import functions from "firebase-functions";
import admin from "firebase-admin";
import { runDailyDrop, normalizeHeader, logClaimFailure } from "./utils.js";

admin.initializeApp();
const db = admin.firestore();

async function getUser(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required",
    );
  }
 const email = (context.auth.token.email || "").toLowerCase();
 const doc = await db.collection("userAccess").doc(email).get();
  if (!doc.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "User not authorized",
    );
  }
  return { email, ...doc.data() };
}

async function requireAdmin(context) {
  const user = await getUser(context);
  if (user.role !== "admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Admin only",
    );
  }
  return user;
}

export const getRides = functions.https.onCall(async (data, context) => {
  await getUser(context);
  const snap = await db.collection("liveRides").get();
  const rides = snap.docs
    .filter((d) => !d.data().claimedBy)
    .map((doc) => ({ id: doc.id, ...doc.data() }));
  return { success: true, rides };
});

export const getRideQueue = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);
  const snap = await db.collection("RideQueue").get();
  const rides = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return { success: true, rides };
});

export const getClaimedRides = functions.https.onCall(async (data, context) => {
  const user = await getUser(context);
  const snap = await db.collection("liveRides").get();
  let rides = snap.docs.filter((d) => d.data().claimedBy);
  if (user.role !== "admin") {
    rides = rides.filter((d) => d.data().claimedBy === user.email);
  }
  rides = rides.map((doc) => ({ id: doc.id, ...doc.data() }));
  return { success: true, rides };
});

export const claimRide = functions.https.onCall(async (data, context) => {
  const user = await getUser(context);
  const { tripId, driverName } = data;
  if (!tripId) return { success: false, message: "tripId required" };

  try {
    await db.runTransaction(async (tx) => {
      const q = await tx.get(
        db.collection("liveRides").where("tripId", "==", tripId).limit(1)
      );
      if (q.empty) {
        throw new functions.https.HttpsError("not-found", "Ride not found");
      }

      const docSnap = q.docs[0];
      const ref = docSnap.ref;
      const ride = docSnap.data();

      if (ride.claimedBy) {
        await logClaimFailure(tripId, user.email, "Ride already claimed");
        throw new functions.https.HttpsError("failed-precondition", "Ride already claimed");
      }

      tx.update(ref, {
        claimedBy: driverName || user.email,
        claimedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return { success: true };
  } catch (err) {
    // If we threw an HttpsError in the txn, surface the right message
    if (err instanceof functions.https.HttpsError) {
      return { success: false, message: err.message };
    }
    console.error("[claimRide] unexpected error", err);
    return { success: false, message: "Unexpected error" };
  }
});


export const addRideToQueue = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);
  const ride = data.ride || {};
  if (!ride.tripId) {
    return { success: false, message: "tripId required" };
  }
  await db.collection("RideQueue").doc(ride.tripId.toString()).set(ride);
  return { success: true };
});

export const updateRide = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);
  const { tripId, fields } = data;
  if (!tripId || !fields) {
    return { success: false, message: "tripId and fields required" };
  }
  const updates = {};
  for (const [k, v] of Object.entries(fields)) {
    updates[normalizeHeader(k)] = v;
  }
  await db.collection("RideQueue").doc(tripId.toString()).update(updates);
  return { success: true };
});

export const deleteRide = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);
  const { tripId } = data;
  if (!tripId) {
    return { success: false, message: "tripId required" };
  }
  await db.collection("RideQueue").doc(tripId.toString()).delete();
  return { success: true };
});

export const dropDailyRides = functions.pubsub
  .schedule("0 18 * * *")
  .timeZone("America/Chicago")
  .onRun(async () => {
    await runDailyDrop();
    return null;
  });

export const dropDailyRidesNow = functions.https.onCall(
  async (data, context) => {
    await requireAdmin(context);
    const result = await runDailyDrop();
    return { success: true, ...result };
  },
);

export const getTicketById = functions.https.onCall(async (data, context) => {
  await getUser(context);
  const { ticketId } = data;
  const doc = await db.collection("ShuttleTickets").doc(ticketId).get();
  if (!doc.exists) {
    return { success: false, message: "Ticket not found" };
  }
  return { success: true, ticket: { id: doc.id, ...doc.data() } };
});

export const getAllTickets = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);
  const snap = await db.collection("ShuttleTickets").get();
  const tickets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return { success: true, tickets };
});

export const addTicket = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);
  const ticket = data.ticket || {};
  if (!ticket.ticketId) {
    return { success: false, message: "ticketId required" };
  }
  ticket.createdAt = admin.firestore.FieldValue.serverTimestamp();
  await db
    .collection("ShuttleTickets")
    .doc(ticket.ticketId.toString())
    .set(ticket);
  return { success: true };
});

export const updateTicketFields = functions.https.onCall(
  async (data, context) => {
    await requireAdmin(context);
    const { ticketId, fields } = data;
    if (!ticketId || !fields) {
      return { success: false, message: "ticketId and fields required" };
    }
    const updates = {};
    for (const [k, v] of Object.entries(fields)) {
      updates[normalizeHeader(k)] = v;
    }
    await db
      .collection("ShuttleTickets")
      .doc(ticketId.toString())
      .update(updates);
    return { success: true };
  },
);

export const deleteTicket = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);
  const { ticketId } = data;
  if (!ticketId) {
    return { success: false, message: "ticketId required" };
  }
  await db.collection("ShuttleTickets").doc(ticketId.toString()).delete();
  return { success: true };
});

export const updateTicketScanStatus = functions.https.onCall(
  async (data, context) => {
    await getUser(context);
    const { ticketId, scanType, driverName } = data;
    if (!ticketId || !scanType) {
      return { success: false, message: "ticketId and scanType required" };
    }
    const update = {};
    const name = driverName || context.auth.token.email || "Unknown";
    if (scanType === "outbound") {
      update.scannedOutbound = true;
      update.scannedOutboundAt = admin.firestore.FieldValue.serverTimestamp();
      update.scannedOutboundBy = name;
    } else if (scanType === "return") {
      update.scannedReturn = true;
      update.scannedReturnAt = admin.firestore.FieldValue.serverTimestamp();
      update.scannedReturnBy = name;
    } else {
      return { success: false, message: "Invalid scanType" };
    }
    await db.collection("ShuttleTickets").doc(ticketId.toString()).update(update);
    return { success: true };
  },
);

export const sendTicketEmail = functions.https.onCall(
  async (data, context) => {
    await requireAdmin(context);
    const { to, subject, body, attachment, filename } = data;
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
  },
);

export const logTimeEntry = functions.https.onCall(async (data, context) => {
  const user = await getUser(context);
  const { driver, rideId, startTime, endTime, duration } = data;
  await db.collection("TimeTracking").add({
    driver: driver || user.email,
    rideId: rideId || null,
    startTime,
    endTime,
    duration,
    loggedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { success: true };
});

