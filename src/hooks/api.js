// hooks/api.js
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db, functions } from "../firebase";
import { httpsCallable } from "firebase/functions";

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
  const q = query(collection(db, "userAccess"), where("email", "==", email));
  const snapshot = await getDocs(q);
  return snapshot.docs.length > 0
    ? { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
    : null;
}

export async function fetchUserAccess(activeOnly = false) {
  const snapshot = await getDocs(collection(db, "userAccess"));
  let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  if (activeOnly) {
    data = data.filter(
      (d) => d.access?.toLowerCase() !== "user" && d.active !== false,
    );
  }
  return data;
}

export function subscribeUserAccess(callback) {
  const q = query(collection(db, "userAccess"), orderBy("name", "asc"));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((d) => d.access?.toLowerCase() !== "user" && d.active !== false);
    callback(data);
  });
}

/**
 * -----------------------------
 * RIDE QUEUE
 * -----------------------------
 */
export function subscribeRideQueue(
  callback,
  fromTime = Timestamp.now(),
) {
  const q = query(
    collection(db, "rideQueue"),
    where("pickupTime", ">=", fromTime),
    orderBy("pickupTime", "asc"),
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });
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
  return await addDoc(collection(db, "rideQueue"), data);
}

export async function updateRideInQueue(rideId, updates) {
  const ref = doc(db, "rideQueue", rideId);
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
  return await deleteDoc(doc(db, "rideQueue", rideId));
}

/**
 * -----------------------------
 * CLAIMED RIDES
 * -----------------------------
 */
export function subscribeClaimedRides(
  callback,
  fromTime = Timestamp.now(),
) {
  const q = query(
    collection(db, "claimedRides"),
    where("pickupTime", ">=", fromTime),
    orderBy("pickupTime", "asc"),
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });
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
  return await addDoc(collection(db, "claimedRides"), data);
}

export async function updateClaimedRide(rideId, updates) {
  let data = { ...updates };
  if (data.pickupTime && !(data.pickupTime instanceof Timestamp))
    data.pickupTime = Timestamp.fromDate(new Date(data.pickupTime));
  if (data.claimedAt && !(data.claimedAt instanceof Timestamp))
    data.claimedAt = Timestamp.fromDate(new Date(data.claimedAt));
  if (data.rideDuration) data.rideDuration = Number(data.rideDuration);
  data = cleanData(data);
  return await updateDoc(doc(db, "claimedRides", rideId), data);
}

export async function deleteClaimedRide(rideId) {
  return await deleteDoc(doc(db, "claimedRides", rideId));
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

export function subscribeClaimLog(callback) {
  const q = query(collection(db, "claimLog"), orderBy("timestamp", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
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
  if (passenger) constraints.push(where("passenger", "==", passenger));
  if (pickupTime) {
    const ts =
      pickupTime instanceof Timestamp
        ? pickupTime
        : Timestamp.fromDate(new Date(pickupTime));
    constraints.push(where("pickupTime", "==", ts));
  }
  constraints.push(orderBy("pickupTime", "asc"));
  const q = query(collection(db, "tickets"), ...constraints);
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });
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
  const q = query(collection(db, "tickets"), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function fetchTicket(ticketId) {
  const ref = doc(db, "tickets", ticketId);
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
  return await addDoc(collection(db, "tickets"), data);
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
  return await updateDoc(doc(db, "tickets", ticketId), data);
}

export async function deleteTicket(ticketId) {
  try {
    await deleteDoc(doc(db, "tickets", ticketId));
    return { success: true };
  } catch (err) {
    console.error("Failed to delete ticket:", err);
    return { success: false, error: err.message };
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
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: SECURE_KEY,
        type: "emailticket",
        ticketId,
        email,
        attachment
      }),
    });
    return await res.json();
  } catch (err) {
    console.error("Email ticket failed", err);
    return { success: false, error: err.message };
  }
}

/**
 * -----------------------------
 * TIME LOGS
 * -----------------------------
 */
export function subscribeTimeLogs(callback) {
  const q = query(collection(db, "timeLogs"), orderBy("loggedAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });
}

export async function fetchTimeLogs(driver) {
  const snapshot = await getDocs(collection(db, "timeLogs"));
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
  return await addDoc(collection(db, "timeLogs"), data);
}

export async function logTime(payload) {
  return await addTimeLog({
    driver: payload.driver,
    rideId: payload.rideId,
    startTime: payload.startTime,
    endTime: payload.endTime,
    duration: Number(payload.duration),
    loggedAt: Timestamp.now(),
  });
}

/**
 * -----------------------------
 * DAILY RIDE DROP
 * -----------------------------
 */
export async function refreshDailyRides() {
  try {
    const callable = httpsCallable(functions, "dropDailyRidesNow");
    const { data } = await callable();
    return { success: true, ...data };
  } catch (err) {
    console.error("Daily drop failed", err);
    return { success: false, error: err.message };
  }
}

/**
 * -----------------------------
 * LIVE RIDES
 * -----------------------------
 */
export async function fetchLiveRides(fromTime = Timestamp.now()) {
  const q = query(
    collection(db, "liveRides"),
    where("pickupTime", ">=", fromTime),
    orderBy("pickupTime", "asc"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
    return { success: false, error: err.message };
  }
}

export async function updateRide(TripID, updates, sheet = "RideQueue") {
  const collectionName = sheet === "RideQueue" ? "rideQueue" : "claimedRides";
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
  const payload = cleanData({
    ...data,
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

export function subscribeShootoutHistory(callback, status) {
  const constraints = status
    ? [where("status", "==", status), orderBy("startTime", "desc")]
    : [orderBy("startTime", "desc")];
  const q = query(collection(db, "shootoutStats"), ...constraints);
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });
}
