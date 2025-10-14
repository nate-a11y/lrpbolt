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
import { getAuth } from "firebase/auth";

import { db } from "../utils/firebaseInit";
import { apiFetch } from "../api";
import { COLLECTIONS } from "../constants";
import { ensureTicketShapeOnCreate } from "../services/db";
import { subscribeFirestore } from "../utils/listenerRegistry";
import logError from "../utils/logError.js";
import { durationMinutes } from "../utils/timeUtils";
import { normalizeTimeLog } from "../utils/normalizeTimeLog.js";
import { nullifyMissing } from "../utils/formatters.js";
import { mapSnapshotToRows } from "../services/normalizers";
import { normalizeRideArray } from "../services/mappers/rides.js";

const lc = (s) => (s || "").toLowerCase();
const currentEmail = () => lc(getAuth().currentUser?.email || "");

// Helper to strip undefined values before sending to Firestore
const cleanData = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://lakeridepros.xyz/claim-proxy.php";
export const SECURE_KEY = import.meta.env.VITE_API_SECRET_KEY;

/**
 * -----------------------------
 * USER / DISPLAY NAMES
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
  let data = snapshot.docs.map((doc) => {
    const d = doc.data() || {};
    return { id: doc.id, ...nullifyMissing(d) };
  });
  if (activeOnly) {
    data = data.filter(
      (d) => d.access?.toLowerCase() !== "user" && d.active !== false,
    );
  }
  return data;
}

/**
 * subscribeUserAccess(cb, { roles }, onError?)
 * Emits array of { id: email, name, email, phone, access }
 */
export function subscribeUserAccess(
  cb,
  { roles = ["admin", "driver"] } = {},
  onError,
) {
  const q = query(
    collection(db, "userAccess"),
    where("access", "in", roles),
    limit(1000),
  );

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => {
          const x = d.data() ?? {};
          const email = (x.email || d.id || "").trim();
          const name =
            (x.name || "").toString().trim() ||
            (email.includes("@") ? email.split("@")[0] : email) ||
            "Unknown";
          return {
            id: email,
            email,
            name,
            phone: (x.phone || "").toString().trim(),
            access: (x.access || "").toString().toLowerCase(),
          };
        })
        .filter(Boolean);
      cb(rows);
    },
    (err) => {
      console.error("[subscribeUserAccess] error:", err);
      if (onError) onError(err);
    },
  );
}

/**
 * subscribeDisplayNameMap(cb, onError?)
 * Emits a merged map { [lowercasedEmail]: displayName } from `users` and `userAccess`.
 * Names from `users` override `userAccess`.
 */
export function subscribeDisplayNameMap(cb, onError) {
  const usersRef = collection(db, "users");
  const accessRef = collection(db, "userAccess");

  let usersMap = {};
  let accessMap = {};

  const safeName = (email, name) => {
    const e = (email || "").trim();
    const n = (name || "").trim();
    if (n) return n;
    if (e.includes("@")) return e.split("@")[0];
    return e || "Unknown";
  };

  const emit = () => {
    // Priority: users > userAccess
    const merged = { ...accessMap, ...usersMap };
    cb(merged);
  };

  const unsubUsers = onSnapshot(
    usersRef,
    (snap) => {
      const next = {};
      snap.forEach((d) => {
        const x = d.data() || {};
        const email = (x.email || d.id || "").toLowerCase().trim();
        if (!email) return;
        next[email] =
          x.name || x.displayName || x.fullName || safeName(email, "");
      });
      usersMap = next;
      emit();
    },
    (err) => onError?.(err),
  );

  const unsubAccess = onSnapshot(
    accessRef,
    (snap) => {
      const next = {};
      snap.forEach((d) => {
        const x = d.data() || {};
        const email = (x.email || d.id || "").toLowerCase().trim();
        if (!email) return;
        next[email] =
          x.name || x.displayName || x.fullName || safeName(email, "");
      });
      accessMap = next;
      emit();
    },
    (err) => onError?.(err),
  );

  return () => {
    unsubUsers && unsubUsers();
    unsubAccess && unsubAccess();
  };
}

/**
 * -----------------------------
 * RIDE QUEUE
 * -----------------------------
 */
export function subscribeRideQueue(callback, fromTime, onError) {
  const start = fromTime || Timestamp.now();
  const key = fromTime
    ? `${COLLECTIONS.RIDE_QUEUE}:${fromTime.toMillis()}`
    : COLLECTIONS.RIDE_QUEUE;
  const q = query(
    collection(db, COLLECTIONS.RIDE_QUEUE),
    where("pickupTime", ">=", start),
    orderBy("pickupTime", "asc"),
  );
  const unsub = subscribeFirestore(
    key,
    q,
    (snapshot) => {
      callback(
        snapshot.docs
          .map((doc) => {
            const d = doc.data() || {};
            return { id: doc.id, ...nullifyMissing(d) };
          })
          .filter(Boolean),
      );
    },
    onError,
  );
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
  return await updateDoc(doc(db, COLLECTIONS.CLAIMED_RIDES, rideId), data);
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

export function subscribeClaimLog(callback, max = 100, onError) {
  const q = query(
    collection(db, "claimLog"),
    orderBy("timestamp", "desc"),
    limit(max),
  );
  const unsub = subscribeFirestore(
    `claimLog:${max}`,
    q,
    (snapshot) => {
      callback(
        snapshot.docs.map((doc) => {
          const d = doc.data() || {};
          return { id: doc.id, ...nullifyMissing(d) };
        }),
      );
    },
    onError,
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
  onError,
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
      callback(mapSnapshotToRows("tickets", snapshot));
    },
    onError,
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
  return mapSnapshotToRows("tickets", snapshot);
}

export async function fetchTicket(ticketId) {
  const ref = doc(db, COLLECTIONS.TICKETS, ticketId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(`Ticket ${ticketId} not found`);
  return { id: snap.id, ...nullifyMissing(snap.data() || {}) };
}

export async function addTicket(ticketData) {
  const data = cleanData(ensureTicketShapeOnCreate(ticketData));
  return await addDoc(collection(db, COLLECTIONS.TICKETS), data);
}

export async function updateTicket(ticketId, updates) {
  let data = { ...updates };
  if (data.pickupTime && !(data.pickupTime instanceof Timestamp))
    data.pickupTime = Timestamp.fromDate(new Date(data.pickupTime));
  if (data.scannedOutboundAt && !(data.scannedOutboundAt instanceof Timestamp))
    data.scannedOutboundAt = Timestamp.fromDate(
      new Date(data.scannedOutboundAt),
    );
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
export function subscribeTimeLogs(onNext, onError) {
  const q = query(collection(db, "timeLogs"));
  return onSnapshot(
    q,
    (snap) => onNext(snap.docs.map((d) => normalizeTimeLog(d.id, d.data()))),
    (err) => onError?.(err),
  );
}

export function subscribeMyTimeLogs(onRows, onError) {
  const email = currentEmail();
  if (!email) {
    onRows([]);
    return () => {};
  }
  const q = query(
    collection(db, "timeLogs"),
    where("userEmail", "==", email),
    orderBy("startTime", "desc"),
    limit(200),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data() || {};
        const n = normalizeTimeLog(d.id, data);
        return {
          id: n.id,
          driverEmail: email,
          rideId: n.rideId || "",
          note: data.note || "",
          startTime: n.startTime,
          endTime: n.endTime,
          duration: n.durationMin || 0,
          loggedAt: n.createdAt,
        };
      });
      onRows(rows);
    },
    onError,
  );
}

export function subscribeShootoutStats(onNext, onError) {
  const q = query(collection(db, "shootoutStats"));
  return onSnapshot(
    q,
    (snap) =>
      onNext(
        snap.docs.map((d) => {
          const data = d.data() || {};
          return { id: d.id, ...nullifyMissing(data) };
        }),
      ),
    (err) => onError?.(err),
  );
}

export async function fetchWeeklySummary({ startTs, endTs }) {
  const q = query(
    collection(db, "timeLogs"),
    where("startTime", ">=", startTs),
    where("startTime", "<", endTs),
    orderBy("startTime", "asc"),
  );
  const snap = await getDocs(q);
  const byDriver = new Map();
  snap.forEach((doc) => {
    const d = doc.data() || {};
    const driver = d.driver || d.driverEmail || null;
    const mins =
      typeof d.duration === "number"
        ? d.duration
        : durationMinutes(d.startTime, d.endTime);
    const prev = byDriver.get(driver) || {
      driver,
      sessions: 0,
      minutes: 0,
      trips: 0,
      passengers: 0,
    };
    byDriver.set(driver, {
      driver,
      sessions: prev.sessions + 1,
      minutes: prev.minutes + mins,
      trips: prev.trips + Number(d.trips || 0),
      passengers: prev.passengers + Number(d.passengers || 0),
    });
  });
  return Array.from(byDriver.values()).map((r) => ({
    ...r,
    hours: +(r.minutes / 60).toFixed(2),
  }));
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
      logData.loggedAt instanceof Timestamp
        ? logData.loggedAt
        : Timestamp.now(),
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
    return {
      success: false,
      message: err?.message || "Unknown Firestore error",
    };
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
  return normalizeRideArray(snapshot);
}

export const subscribeLiveRides = (onNext, onError) =>
  onSnapshot(
    collection(db, "liveRides"),
    (snap) => onNext(normalizeRideArray(snap)),
    (err) => onError?.(err),
  );

export const subscribeQueueRides = (onNext, onError) =>
  onSnapshot(
    collection(db, "rideQueue"),
    (snap) => onNext(normalizeRideArray(snap)),
    (err) => onError?.(err),
  );

export const subscribeClaimedRides = (onNext, onError) =>
  onSnapshot(
    collection(db, "claimedRides"),
    (snap) => onNext(normalizeRideArray(snap)),
    (err) => onError?.(err),
  );

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

  const normalizeDriverEmail = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value.trim().toLowerCase();
    if (typeof value === "object") {
      const candidate =
        value.email ||
        value.primaryEmail ||
        value.loginEmail ||
        value.userEmail ||
        value.contactEmail ||
        value.claims?.email ||
        value.profile?.email ||
        "";
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim().toLowerCase();
      }
    }
    return "";
  };

  const driverEmail = normalizeDriverEmail(driver);
  if (!driverEmail) throw new Error("claimRideAtomic: missing driver email");

  const {
    pickupTime,
    rideDuration,
    claimedByName: extraClaimedByName,
    ...rawRest
  } = extra;
  const {
    claimedBy: _claimedBy,
    ClaimedBy: _legacyClaimedBy,
    ...rest
  } = rawRest;
  void _claimedBy;
  void _legacyClaimedBy;

  const driverName =
    (typeof driver === "object" &&
      (driver.displayName ||
        driver.name ||
        driver.fullName ||
        driver.full_name ||
        driver.driverName ||
        driver.preferredName)) ||
    extraClaimedByName ||
    driverEmail;

  const srcRef = doc(db, COLLECTIONS.LIVE_RIDES, rideId);
  const dstRef = doc(db, COLLECTIONS.CLAIMED_RIDES, rideId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(srcRef);
    if (!snap.exists()) throw new Error("Already claimed or not found");
    const data = snap.data();

    if (data.status && data.status !== "open") {
      throw new Error("Ride not claimable");
    }

    const now = serverTimestamp();
    const pickup = pickupTime ?? data.pickupTime ?? data.PickupTime;
    const duration = rideDuration ?? data.rideDuration ?? data.RideDuration;
    tx.set(dstRef, {
      ...data,
      ...rest,
      // Maintain both legacy and new field names for compatibility
      claimedBy: driverEmail,
      ClaimedBy: driverEmail,
      claimedByName: driverName,
      claimedAt: now,
      ClaimedAt: now,
      status: "claimed",
      lastModifiedBy: driverEmail,
      pickupTime: pickup,
      PickupTime: pickup,
      rideDuration: duration,
      RideDuration: duration,
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
      return { id: d.id, ...nullifyMissing(data) };
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
  return mapSnapshotToRows("shootoutStats", snap).filter(Boolean);
}

export function subscribeShootoutHistoryAll(
  callback,
  status,
  max = 200,
  onError,
) {
  const constraints = [];
  if (status) constraints.push(where("status", "==", status));
  constraints.push(orderBy("startTime", "desc"), limit(max));
  const q = query(collection(db, "shootoutStats"), ...constraints);
  const unsub = onSnapshot(
    q,
    (snap) => {
      const rows = mapSnapshotToRows("shootoutStats", snap).filter(Boolean);
      callback(rows);
    },
    (e) => {
      logError(e, {
        area: "FirestoreSubscribe",
        comp: "subscribeShootoutHistoryAll",
      });
      onError?.(e);
    },
  );
  return () => unsub();
}

/**
 * -----------------------------
 * PATCH HELPERS (typed coercion for grids)
 * -----------------------------
 */

// Update a single timeLogs doc with proper Timestamp / minutes handling.
export async function patchTimeLog(id, updates) {
  if (!id) throw new Error("patchTimeLog: missing id");
  const ref = doc(db, "timeLogs", id);
  const coerceTs = (v) =>
    v == null
      ? null
      : v instanceof Timestamp
        ? v
        : Timestamp.fromMillis(Number(v));

  const data = cleanData({
    driver: updates.driver,
    rideId: updates.rideId,
    startTime:
      updates.startTime !== undefined ? coerceTs(updates.startTime) : undefined,
    endTime:
      updates.endTime !== undefined ? coerceTs(updates.endTime) : undefined,
    loggedAt:
      updates.loggedAt !== undefined ? coerceTs(updates.loggedAt) : undefined,
    note: updates.note,
    // stored as minutes in Firestore
    duration:
      updates.durationMin !== undefined
        ? Number.isFinite(Number(updates.durationMin))
          ? Math.round(Number(updates.durationMin))
          : 0
        : undefined,
  });

  // keep duration consistent if both times present (wins over manual duration)
  const s = data.startTime?.toMillis?.();
  const e = data.endTime?.toMillis?.();
  if (Number.isFinite(s) && Number.isFinite(e) && e >= s) {
    data.duration = Math.floor((e - s) / 60000);
  }

  await updateDoc(ref, data);
}

// Update a single shootoutStats doc with proper Timestamp / integer handling.
export async function patchShootoutStat(id, updates) {
  if (!id) throw new Error("patchShootoutStat: missing id");
  const ref = doc(db, "shootoutStats", id);
  const coerceTs = (v) =>
    v == null
      ? null
      : v instanceof Timestamp
        ? v
        : Timestamp.fromMillis(Number(v));
  const asInt = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : d;
  };

  const data = cleanData({
    driverEmail: updates.driverEmail,
    vehicle: updates.vehicle,
    trips: updates.trips !== undefined ? asInt(updates.trips, 0) : undefined,
    passengers:
      updates.passengers !== undefined
        ? asInt(updates.passengers, 0)
        : undefined,
    startTime:
      updates.startTime !== undefined ? coerceTs(updates.startTime) : undefined,
    endTime:
      updates.endTime !== undefined ? coerceTs(updates.endTime) : undefined,
    createdAt:
      updates.createdAt !== undefined ? coerceTs(updates.createdAt) : undefined,
  });

  await updateDoc(ref, data);
}
