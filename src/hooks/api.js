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
  orderBy
} from "firebase/firestore";
import { db } from "../firebase";
import { Timestamp } from "firebase/firestore";

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

export async function fetchUserAccess() {
  const snapshot = await getDocs(collection(db, "userAccess"));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export function subscribeUserAccess(callback) {
  const q = query(collection(db, "userAccess"), orderBy("name", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
}

/**
 * -----------------------------
 * RIDE QUEUE
 * -----------------------------
 */
export function subscribeRideQueue(callback) {
  const q = query(collection(db, "rideQueue"), orderBy("pickupTime", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
}

export async function addRideToQueue(rideData) {
  return await addDoc(collection(db, "rideQueue"), {
    ...rideData,
    pickupTime: Timestamp.fromDate(new Date(rideData.pickupTime)),
    rideDuration: Number(rideData.rideDuration),
    claimedAt: rideData.claimedAt ? Timestamp.fromDate(new Date(rideData.claimedAt)) : null
  });
}

export async function updateRideInQueue(rideId, updates) {
  const ref = doc(db, "rideQueue", rideId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(`Ride ${rideId} not found`);
  const data = { ...updates };
  if (data.pickupTime) data.pickupTime = Timestamp.fromDate(new Date(data.pickupTime));
  if (data.claimedAt) data.claimedAt = Timestamp.fromDate(new Date(data.claimedAt));
  if (data.rideDuration) data.rideDuration = Number(data.rideDuration);
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
export function subscribeClaimedRides(callback) {
  const q = query(collection(db, "claimedRides"), orderBy("pickupTime", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
}

export async function claimRide(rideData) {
  return await addDoc(collection(db, "claimedRides"), {
    ...rideData,
    pickupTime: Timestamp.fromDate(new Date(rideData.pickupTime)),
    rideDuration: Number(rideData.rideDuration),
    claimedAt: Timestamp.fromDate(new Date())
  });
}

export async function updateClaimedRide(rideId, updates) {
  const data = { ...updates };
  if (data.pickupTime) data.pickupTime = Timestamp.fromDate(new Date(data.pickupTime));
  if (data.claimedAt) data.claimedAt = Timestamp.fromDate(new Date(data.claimedAt));
  if (data.rideDuration) data.rideDuration = Number(data.rideDuration);
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
  return await addDoc(collection(db, "claimLog"), {
    ...claimData,
    timestamp: Timestamp.fromDate(new Date(claimData.timestamp || Date.now())),
  });
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
export function subscribeTickets(callback) {
  const q = query(collection(db, "tickets"), orderBy("pickupTime", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });
}

export async function fetchTickets() {
  const snapshot = await getDocs(collection(db, "tickets"));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function fetchTicket(ticketId) {
  const ref = doc(db, "tickets", ticketId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(`Ticket ${ticketId} not found`);
  return { id: snap.id, ...snap.data() };
}

export async function addTicket(ticketData) {
  return await addDoc(collection(db, "tickets"), {
    ...ticketData,
    pickupTime: Timestamp.fromDate(new Date(ticketData.pickupTime)),
    passengercount: Number(ticketData.passengercount),
    scannedOutbound: !!ticketData.scannedOutbound,
    scannedReturn: !!ticketData.scannedReturn,
    createdAt: Timestamp.fromDate(new Date())
  });
}

export async function updateTicket(ticketId, updates) {
  const data = { ...updates };
  if (data.pickupTime) data.pickupTime = Timestamp.fromDate(new Date(data.pickupTime));
  if (data.scannedOutboundAt) data.scannedOutboundAt = Timestamp.fromDate(new Date(data.scannedOutboundAt));
  if (data.scannedReturnAt) data.scannedReturnAt = Timestamp.fromDate(new Date(data.scannedReturnAt));
  if (data.createdAt) data.createdAt = Timestamp.fromDate(new Date(data.createdAt));
  if (data.passengercount) data.passengercount = Number(data.passengercount);
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
    updates.scannedOutboundAt = Timestamp.fromDate(new Date());
    updates.scannedOutboundBy = scannedBy;
  }
  if (scanType === "return") {
    updates.scannedReturn = true;
    updates.scannedReturnAt = Timestamp.fromDate(new Date());
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
 * DRIVER ROTATION
 * -----------------------------
 */
export function subscribeDriverRotation(callback) {
  const q = query(collection(db, "driverRotation"), orderBy("priority", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });
}

export async function fetchDrivers() {
  const snapshot = await getDocs(collection(db, "driverRotation"));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function updateDriverRotation(driverId, updates) {
  return await updateDoc(doc(db, "driverRotation", driverId), updates);
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
  let logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  if (driver) logs = logs.filter(log => log.driver === driver);
  return logs;
}

export async function addTimeLog(logData) {
  return await addDoc(collection(db, "timeLogs"), {
    ...logData,
    startTime: Timestamp.fromDate(new Date(logData.startTime)),
    endTime: logData.endTime ? Timestamp.fromDate(new Date(logData.endTime)) : null,
    duration: Number(logData.duration),
    loggedAt: Timestamp.fromDate(new Date())
  });
}

export async function logTime(payload) {
  return await addTimeLog({
    driver: payload.driver,
    rideId: payload.rideId,
    startTime: new Date(payload.startTime),
    endTime: payload.endTime ? new Date(payload.endTime) : null,
    duration: Number(payload.duration),
    loggedAt: new Date()
  });
}

/**
 * -----------------------------
 * LIVE RIDES
 * -----------------------------
 */
export async function fetchLiveRides() {
  const snapshot = await getDocs(collection(db, "liveRides"));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
  const data = { ...updates };
  if (data.pickupTime) data.pickupTime = Timestamp.fromDate(new Date(data.pickupTime));
  if (data.claimedAt) data.claimedAt = Timestamp.fromDate(new Date(data.claimedAt));
  if (data.rideDuration) data.rideDuration = Number(data.rideDuration);
  await updateDoc(ref, data);
  return { success: true };
}

/**
 * -----------------------------
 * SHOOTOUT STATS
 * -----------------------------
 */
export async function startShootoutSession(data) {
  return await addDoc(collection(db, "shootoutStats"), {
    ...data,
    startTime: Timestamp.fromDate(new Date(data.startTime)),
    createdAt: Timestamp.fromDate(new Date()),
    status: "running"
  });
}

export async function endShootoutSession(sessionId, data) {
  const ref = doc(db, "shootoutStats", sessionId);
  return await updateDoc(ref, {
    endTime: data.endTime ? Timestamp.fromDate(new Date(data.endTime)) : null,
    duration: data.duration,
    trips: data.trips,
    passengers: data.passengers,
    status: "completed"
  });
}

export function subscribeShootoutHistory(callback) {
  const q = query(collection(db, "shootoutStats"), orderBy("startTime", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
}
