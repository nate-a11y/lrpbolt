// hooks/api.js
import {
  collection,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { subscribeFirestore } from "../utils/listenerRegistry";
import { logError } from "../utils/logError";
import { apiFetch } from "../api";
import { COLLECTIONS } from "../constants";
import { getAuth } from "firebase/auth";

const lc = (s) => (s || "").toLowerCase();
const currentEmail = () => lc(getAuth().currentUser?.email || "");
const tsToDate = (ts) => (ts && typeof ts.toDate === "function" ? ts.toDate() : null);

// Helper to strip undefined values before sending to Firestore
const cleanData = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://lakeridepros.xyz/claim-proxy.php";
export const SECURE_KEY = import.meta.env.VITE_API_SECRET_KEY;

/**
 * -----------------------------
 * USER ACCESS
 * -----------------------------
 */
export async function getUserAccess(email) {
  const lcEmail = (email || "").toLowerCase();
  if (!lcEmail) return null;
  // Initialize caches on first use
  if (!getUserAccess.cache) getUserAccess.cache = new Map();
  if (!getUserAccess.pending) getUserAccess.pending = new Map();

  // Serve from cache if available
  if (getUserAccess.cache.has(lcEmail)) return getUserAccess.cache.get(lcEmail);
  // Reuse pending request to avoid duplicate network calls
  if (getUserAccess.pending.has(lcEmail))
    return await getUserAccess.pending.get(lcEmail);

  const q = query(
    collection(db, COLLECTIONS.USER_ACCESS),
    where("email", "==", lcEmail),
  );
  const fetchPromise = getDocs(q).then((snapshot) => {
    const record =
      snapshot.docs.length > 0
        ? { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
        : null;
    getUserAccess.cache.set(lcEmail, record);
    getUserAccess.pending.delete(lcEmail);
    return record;
  });

  getUserAccess.pending.set(lcEmail, fetchPromise);
  return await fetchPromise;
}

export async function fetchUserAccess(activeOnly = false) {
  const snapshot = await getDocs(collection(db, COLLECTIONS.USER_ACCESS));
  let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  if (activeOnly) {
    data = data.filter(
      (d) => d.access?.toLowerCase() !== "user" && d.active !== false,
    );
  }
  return data;
}

export function subscribeUserAccess(
  onRows,
  { activeOnly = false, roles = ["admin", "driver"], max = 100 } = {},
  onError,
) {
  const coll = collection(db, "userAccess");
  const clauses = [];
  if (activeOnly) clauses.push(where("active", "==", true));
  if (roles?.length)
    clauses.push(where("access", "in", roles.map((r) => r.toLowerCase())));
  const q = query(coll, ...clauses, limit(Math.min(max || 100, 500)));

  const unsub = onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id, // lowercase email
          name: data.name || "",
          email: data.email || d.id,
          access: (data.access || "").toLowerCase(),
          active: data.active !== false,
        };
      });
      onRows(rows);
    },
    (e) => {
      logError(e, { area: "FirestoreSubscribe", comp: "subscribeUserAccess" });
      onError?.(e);
    },
  );
  return () => unsub();
}

/**
 * -----------------------------
 * RIDE QUEUE
 * -----------------------------
 */
export function subscribeRideQueue(callback, fromTime) {
  const start = fromTime || Timestamp.now();
  const key = fromTime
    ? `${COLLECTIONS.RIDE_QUEUE}:${fromTime.toMillis()}`
    : COLLECTIONS.RIDE_QUEUE;
  const q = query(
    collection(db, COLLECTIONS.RIDE_QUEUE),
    where("pickupTime", ">=", start),
    orderBy("pickupTime", "asc"),
  );
    const unsub = subscribeFirestore(key, q, (snapshot) => {
      callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsub();
    };
  }

export async function addRideToQueue(rideData) {
  const data = cleanData({
    ...rideData,
    pickupTime:
      rideData.pickupTime instanceof Timestamp
        ? rideData.pickupTime
        : Timestamp.fromDate(new Date(rideData.pickupTime)),
    rideDuration: Number(rideData.rideDuration),
    claimedAt: rideData.claimedAt
      ? rideData.claimedAt instanceof Timestamp
        ? rideData.claimedAt
        : Timestamp.fromDate(new Date(rideData.claimedAt))
      : null,
  });
  return await addDoc(collection(db, COLLECTIONS.RIDE_QUEUE), data);
}

export async function updateRideInQueue(rideId, updates) {
  const ref = doc(db, COLLECTIONS.RIDE_QUEUE, rideId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(`Ride ${rideId} not found`);
  let data = { ...updates };
  if (data.pickupTime && !(data.pickupTime instanceof Timestamp))
    data.pickupTime = Timestamp.fromDate(new Date(data.pickupTime));
  if (data.claimedAt && !(data.claimedAt instanceof Timestamp))
    data.claimedAt = Timestamp.fromDate(new Date(data.claimedAt));
  if (data.rideDuration) data.rideDuration = Number(data.rideDuration);
  data = cleanData(data);
  return await updateDoc(ref, data);
}

export async function deleteRideFromQueue(rideId) {
  return await deleteDoc(doc(db, COLLECTIONS.RIDE_QUEUE, rideId));
}

/**
 * -----------------------------
 * CLAIMED RIDES
 * -----------------------------
 */
export function subscribeClaimedRides(callback, fromTime) {
  const start = fromTime || Timestamp.now();
  const key = fromTime
    ? `${COLLECTIONS.CLAIMED_RIDES}:${fromTime.toMillis()}`
    : COLLECTIONS.CLAIMED_RIDES;
  const q = query(
    collection(db, COLLECTIONS.CLAIMED_RIDES),
    where("pickupTime", ">=", start),
    orderBy("pickupTime", "asc"),
  );
    const unsub = subscribeFirestore(key, q, (snapshot) => {
      callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsub();
    };
  }

export async function claimRide(rideData) {
  const data = cleanData({
    ...rideData,
    pickupTime:
      rideData.pickupTime instanceof Timestamp
        ? rideData.pickupTime
        : Timestamp.fromDate(new Date(rideData.pickupTime)),
    rideDuration: Number(rideData.rideDuration),
    claimedAt: Timestamp.now(),
  });
  return await addDoc(collection(db, COLLECTIONS.CLAIMED_RIDES), data);
}

export async function updateClaimedRide(rideId, updates) {
  let data = { ...updates };
  if (data.pickupTime && !(data.pickupTime instanceof Timestamp))
    data.pickupTime = Timestamp.fromDate(new Date(data.pickupTime));
  if (data.claimedAt && !(data.claimedAt instanceof Timestamp))
    data.claimedAt = Timestamp.fromDate(new Date(data.claimedAt));
  if (data.rideDuration) data.rideDuration = Number(data.rideDuration);
  data = cleanData(data);
  return await updateDoc(
    doc(db, COLLECTIONS.CLAIMED_RIDES, rideId),
    data,
  );
}

export async function deleteClaimedRide(rideId) {
  return await deleteDoc(doc(db, COLLECTIONS.CLAIMED_RIDES, rideId));
}

/**
 * -----------------------------
 * CLAIM LOG
 * -----------------------------
 */
export async function logClaim(claimData) {
  const data = cleanData({
    ...claimData,
    timestamp:
      claimData.timestamp instanceof Timestamp
        ? claimData.timestamp
        : Timestamp.fromMillis(claimData.timestamp || Date.now()),
  });
  return await addDoc(collection(db, "claimLog"), data);
}

export function subscribeClaimLog(callback, max = 100) {
  const q = query(
    collection(db, "claimLog"),
    orderBy("timestamp", "desc"),
    limit(max),
  );
    const unsub = subscribeFirestore(
      `claimLog:${max}`,
      q,
      (snapshot) => {
        callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
    );
    return () => {
      unsub();
    };
  }

/**
 * -----------------------------
 * TICKETS
 * -----------------------------
 */
export function subscribeTickets(
  callback,
  { passenger, pickupTime } = {},
) {
  const constraints = [];
  const keyParts = [COLLECTIONS.TICKETS, passenger || "all"];
  if (passenger) constraints.push(where("passenger", "==", passenger));
  if (pickupTime) {
    const ts =
      pickupTime instanceof Timestamp
        ? pickupTime
        : Timestamp.fromDate(new Date(pickupTime));
    constraints.push(where("pickupTime", "==", ts));
    keyParts.push(ts.toMillis());
  }
  constraints.push(orderBy("pickupTime", "asc"));
  const q = query(collection(db, COLLECTIONS.TICKETS), ...constraints);
    const unsub = subscribeFirestore(
      keyParts.join(":"),
      q,
      (snapshot) => {
        callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
    );
    return () => {
      unsub();
    };
  }

export async function fetchTickets(filters = {}) {
  const { passenger, pickupTime } = filters;
  const constraints = [];
  if (passenger) constraints.push(where("passenger", "==", passenger));
  if (pickupTime) {
    const ts =
      pickupTime instanceof Timestamp
        ? pickupTime
        : Timestamp.fromDate(new Date(pickupTime));
    constraints.push(where("pickupTime", "==", ts));
  }
  constraints.push(orderBy("pickupTime", "asc"));
  const q = query(collection(db, COLLECTIONS.TICKETS), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function fetchTicket(ticketId) {
  const ref = doc(db, COLLECTIONS.TICKETS, ticketId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(`Ticket ${ticketId} not found`);
  return { id: snap.id, ...snap.data() };
}

export async function addTicket(ticketData) {
  const data = cleanData({
    ...ticketData,
    pickupTime:
      ticketData.pickupTime instanceof Timestamp
        ? ticketData.pickupTime
        : Timestamp.fromDate(new Date(ticketData.pickupTime)),
    passengercount: Number(ticketData.passengercount),
    scannedOutbound: !!ticketData.scannedOutbound,
    scannedReturn: !!ticketData.scannedReturn,
    createdAt: Timestamp.now(),
  });
  return await addDoc(collection(db, COLLECTIONS.TICKETS), data);
}

export async function updateTicket(ticketId, updates) {
  let data = { ...updates };
  if (data.pickupTime && !(data.pickupTime instanceof Timestamp))
    data.pickupTime = Timestamp.fromDate(new Date(data.pickupTime));
  if (data.scannedOutboundAt && !(data.scannedOutboundAt instanceof Timestamp))
    data.scannedOutboundAt = Timestamp.fromDate(new Date(data.scannedOutboundAt));
  if (data.scannedReturnAt && !(data.scannedReturnAt instanceof Timestamp))
    data.scannedReturnAt = Timestamp.fromDate(new Date(data.scannedReturnAt));
  if (data.createdAt && !(data.createdAt instanceof Timestamp))
    data.createdAt = Timestamp.fromDate(new Date(data.createdAt));
  if (data.passengercount) data.passengercount = Number(data.passengercount);
  data = cleanData(data);
  return await updateDoc(doc(db, COLLECTIONS.TICKETS, ticketId), data);
}

export async function deleteTicket(ticketId) {
  try {
    await deleteDoc(doc(db, COLLECTIONS.TICKETS, ticketId));
    return { success: true };
  } catch (err) {
    logError(err, "Failed to delete ticket");
    return { success: false, error: err?.message || JSON.stringify(err) };
  }
}

export async function updateTicketScan(ticketId, scanType, scannedBy) {
  const updates = {};
  if (scanType === "outbound") {
    updates.scannedOutbound = true;
    updates.scannedOutboundAt = Timestamp.now();
    updates.scannedOutboundBy = scannedBy;
  }
  if (scanType === "return") {
    updates.scannedReturn = true;
    updates.scannedReturnAt = Timestamp.now();
    updates.scannedReturnBy = scannedBy;
  }
  await updateTicket(ticketId, updates);
  return { success: true };
}

// ---- Email Ticket (temporary - still uses old API) ----
export async function emailTicket(ticketId, email, attachment) {
  try {
    return await apiFetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: SECURE_KEY,
        type: "emailticket",
        ticketId,
        email,
        attachment,
      }),
    });
  } catch (err) {
    logError(err, "Email ticket failed");
    return { success: false, error: err?.message || JSON.stringify(err) };
  }
}

/**
 * -----------------------------
 * TIME LOGS
 * -----------------------------
 */
export function subscribeTimeLogs(callback, driver, max = 100) {
  const constraints = [orderBy("loggedAt", "desc"), limit(max)];
  if (driver) constraints.push(where("driver", "==", driver));
  const q = query(collection(db, COLLECTIONS.TIME_LOGS), ...constraints);
    const key = `${COLLECTIONS.TIME_LOGS}:${driver || "all"}:${max}`;
    const unsub = subscribeFirestore(key, q, (snapshot) => {
      callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsub();
    };
  }

export async function fetchTimeLogs(driver) {
  const snapshot = await getDocs(collection(db, COLLECTIONS.TIME_LOGS));
  let logs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  if (driver) logs = logs.filter((log) => log.driver === driver);
  return logs;
}

export async function addTimeLog(logData) {
  const data = cleanData({
    ...logData,
    startTime:
      logData.startTime instanceof Timestamp
        ? logData.startTime
        : Timestamp.fromDate(new Date(logData.startTime)),
    endTime: logData.endTime
      ? logData.endTime instanceof Timestamp
        ? logData.endTime
        : Timestamp.fromDate(new Date(logData.endTime))
      : null,
    duration: Number(logData.duration),
    loggedAt:
      logData.loggedAt instanceof Timestamp ? logData.loggedAt : Timestamp.now(),
  });
  return await addDoc(collection(db, COLLECTIONS.TIME_LOGS), data);
}

export async function logTime(payload) {
  try {
    await addTimeLog({
      driver: payload.driver,
      rideId: payload.rideId,
      startTime: payload.startTime,
      endTime: payload.endTime,
      duration: Number(payload.duration),
      loggedAt: Timestamp.now(),
    });
    return { success: true }; // ✅ Required for TimeClock to show success
  } catch (err) {
    console.error("logTime failed:", err);
    return { success: false, message: err?.message || "Unknown Firestore error" };
  }
}


/**
 * -----------------------------
 * LIVE RIDES
 * -----------------------------
 */
export async function fetchLiveRides(fromTime = Timestamp.now()) {
  const q = query(
    collection(db, COLLECTIONS.LIVE_RIDES),
    where("pickupTime", ">=", fromTime),
    orderBy("pickupTime", "asc"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export function subscribeLiveRides(callback, fromTime) {
  const start = fromTime || Timestamp.now();
  const key = fromTime
    ? `${COLLECTIONS.LIVE_RIDES}:${fromTime.toMillis()}`
    : COLLECTIONS.LIVE_RIDES;
  const q = query(
    collection(db, COLLECTIONS.LIVE_RIDES),
    where("pickupTime", ">=", start),
    orderBy("pickupTime", "asc"),
  );
    const unsub = subscribeFirestore(key, q, (snapshot) => {
      callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsub();
    };
  }

export async function addLiveRide(rideData) {
  const data = cleanData({
    ...rideData,
    pickupTime:
      rideData.pickupTime instanceof Timestamp
        ? rideData.pickupTime
        : Timestamp.fromDate(new Date(rideData.pickupTime)),
    rideDuration: Number(rideData.rideDuration),
    claimedAt: rideData.claimedAt
      ? rideData.claimedAt instanceof Timestamp
        ? rideData.claimedAt
        : Timestamp.fromDate(new Date(rideData.claimedAt))
      : null,
  });
  return await addDoc(collection(db, COLLECTIONS.LIVE_RIDES), data);
}

export async function deleteLiveRide(rideId) {
  return await deleteDoc(doc(db, COLLECTIONS.LIVE_RIDES, rideId));
}

export async function claimRideAtomic(rideId, driver, extra = {}) {
  if (!rideId) throw new Error("claimRideAtomic: missing rideId");
  if (!driver) throw new Error("claimRideAtomic: missing driver");

  const srcRef = doc(db, COLLECTIONS.LIVE_RIDES, rideId);
  const dstRef = doc(db, COLLECTIONS.CLAIMED_RIDES, rideId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(srcRef);
    if (!snap.exists()) throw new Error("Already claimed or not found");
    const data = snap.data();

    if (data.status && data.status !== "open") {
      throw new Error("Ride not claimable");
    }

    tx.set(dstRef, {
      ...data,
      ClaimedBy: driver,
      claimedAt: serverTimestamp(),
      status: "claimed",
      ...extra,
    });
    tx.delete(srcRef);
  });

  return true;
}

export async function restoreLiveRide(rideData) {
  try {
    await addLiveRide(rideData);
    return { success: true };
  } catch (err) {
    logError(err, "restoreLiveRide");
    return { success: false, error: err?.message || JSON.stringify(err) };
  }
}

/**
 * -----------------------------
 * RESTORE RIDE
 * -----------------------------
 */
export async function restoreRide(rideData) {
  try {
    await addRideToQueue(rideData);
    return { success: true };
  } catch (err) {
    logError(err, "restoreRide");
    return { success: false, error: err?.message || JSON.stringify(err) };
  }
}

export async function updateRide(
  TripID,
  updates,
  sheet = COLLECTIONS.RIDE_QUEUE,
) {
  const collectionName =
    sheet === COLLECTIONS.RIDE_QUEUE
      ? COLLECTIONS.RIDE_QUEUE
      : COLLECTIONS.CLAIMED_RIDES;
  const ref = doc(db, collectionName, TripID);
  let data = { ...updates };
  if (data.pickupTime && !(data.pickupTime instanceof Timestamp))
    data.pickupTime = Timestamp.fromDate(new Date(data.pickupTime));
  if (data.claimedAt && !(data.claimedAt instanceof Timestamp))
    data.claimedAt = Timestamp.fromDate(new Date(data.claimedAt));
  if (data.rideDuration) data.rideDuration = Number(data.rideDuration);
  data = cleanData(data);
  await updateDoc(ref, data);
  return { success: true };
}

/**
 * -----------------------------
 * SHOOTOUT STATS
 * -----------------------------
 */
export async function startShootoutSession(data) {
  const userEmail = currentEmail();
  const payload = cleanData({
    ...data,
    userEmail,
    startTime:
      data.startTime instanceof Timestamp
        ? data.startTime
        : Timestamp.fromDate(new Date(data.startTime)),
    createdAt: Timestamp.now(),
    status: "running",
  });
  return await addDoc(collection(db, "shootoutStats"), payload);
}

export async function endShootoutSession(sessionId, data) {
  const ref = doc(db, "shootoutStats", sessionId);
  const payload = cleanData({
    endTime: data.endTime
      ? data.endTime instanceof Timestamp
        ? data.endTime
        : Timestamp.fromDate(new Date(data.endTime))
      : null,
    duration: data.duration,
    trips: data.trips,
    passengers: data.passengers,
    status: "completed",
  });
  return await updateDoc(ref, payload);
}

export function subscribeShootoutHistory(callback, status, max = 100) {
  const userEmail = currentEmail();
  const constraints = [];
  if (status) constraints.push(where("status", "==", status));
  // align with rules: owner-only unless admin path uses a different API
  constraints.push(where("userEmail", "==", userEmail));
  constraints.push(orderBy("startTime", "desc"), limit(max));

  const q = query(collection(db, "shootoutStats"), ...constraints);
  const key = `shootoutStats:${status || "all"}:${userEmail}:${max}`;

  const unsub = subscribeFirestore(key, q, (snapshot) => {
    const rows = snapshot.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        ...data,
        startTime: tsToDate(data.startTime),
        endTime: tsToDate(data.endTime),
      };
    });
    callback(rows);
  });
  return () => unsub();
}

export async function fetchShootoutHistory(status, max = 100) {
  const userEmail = currentEmail();
  const constraints = [];
  if (status) constraints.push(where("status", "==", status));
  constraints.push(where("userEmail", "==", userEmail));
  constraints.push(orderBy("startTime", "desc"), limit(max));
  const q = query(collection(db, "shootoutStats"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() || {};
    return {
      id: d.id,
      ...data,
      startTime: tsToDate(data.startTime),
      endTime: tsToDate(data.endTime),
    };
  });
}

export function subscribeShootoutHistoryAll(callback, status, max = 200, onError) {
  const constraints = [];
  if (status) constraints.push(where("status", "==", status));
  constraints.push(orderBy("startTime", "desc"), limit(max));
  const q = query(collection(db, "shootoutStats"), ...constraints);
  const unsub = onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,
          ...data,
          startTime: tsToDate(data.startTime),
          endTime: tsToDate(data.endTime),
        };
      });
      callback(rows);
    },
    (e) => {
      logError(e, { area: "FirestoreSubscribe", comp: "subscribeShootoutHistoryAll" });
      onError?.(e);
    },
  );
  return () => unsub();
}
