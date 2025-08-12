import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import { COLLECTIONS, TIMEZONE } from "../constants";
import { db } from "../utils/firebaseInit";
import { subscribeFirestore } from "../utils/listenerRegistry";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);

// Prepare ride data for Firestore writes
const prepareRideData = (ride) => {
  const data = {
    tripId: ride.tripId || ride.TripID,
    pickupTime: ride.pickupTime || ride.PickupTime,
    rideDuration: ride.rideDuration || ride.RideDuration,
    rideType: ride.rideType || ride.RideType,
    vehicle: ride.vehicle || ride.Vehicle,
    rideNotes: ride.rideNotes || ride.RideNotes || null,
    claimedBy: ride.claimedBy || ride.ClaimedBy || null,
    claimedAt: ride.claimedAt || ride.ClaimedAt || null,
    createdBy: ride.createdBy || ride.CreatedBy,
    lastModifiedBy: ride.lastModifiedBy || ride.LastModifiedBy,
  };

  if (data.pickupTime && !(data.pickupTime instanceof Timestamp)) {
    data.pickupTime = Timestamp.fromDate(new Date(data.pickupTime));
  }
  if (data.claimedAt && !(data.claimedAt instanceof Timestamp)) {
    data.claimedAt = Timestamp.fromDate(new Date(data.claimedAt));
  }
  if (data.rideDuration !== undefined) {
    data.rideDuration = Number(data.rideDuration);
  }

  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  );
};

// Convert Firestore ride document into UI-friendly structure
export const normalizeRideData = (ride) => {
  const tripId = ride.tripId || ride.TripID || ride.id;
  const pickupTs = ride.pickupTime || ride.PickupTime;
  const claimedTs = ride.claimedAt || ride.ClaimedAt;
  let pickupDate = null;
  let claimedDate = null;
  if (pickupTs instanceof Timestamp) pickupDate = pickupTs.toDate();
  else if (pickupTs) pickupDate = new Date(pickupTs);
  if (claimedTs instanceof Timestamp) claimedDate = claimedTs.toDate();
  else if (claimedTs) claimedDate = new Date(claimedTs);

  if (!tripId || !pickupDate) {
    console.warn("normalizeRideData: missing required fields", {
      tripId,
      pickupTs,
    });
  }

  const durationMinutes =
    ride.rideDuration !== undefined ? ride.rideDuration : ride.RideDuration;
  const formattedDuration =
    typeof durationMinutes === "number"
      ? dayjs.duration(durationMinutes, "minutes").format("HH:mm")
      : "N/A";

  return {
    id: ride.id,
    tripId,
    TripID: tripId,
    pickupTime: pickupDate,
    PickupTime: pickupDate
      ? dayjs(pickupDate).tz(TIMEZONE).format("h:mm A")
      : "N/A",
    Date: pickupDate
      ? dayjs(pickupDate).tz(TIMEZONE).format("MM/DD/YYYY")
      : "N/A",
    rideDuration: durationMinutes,
    RideDuration: formattedDuration,
    rideType: ride.rideType || ride.RideType || "N/A",
    RideType: ride.rideType || ride.RideType || "N/A",
    vehicle: ride.vehicle || ride.Vehicle || "N/A",
    Vehicle: ride.vehicle || ride.Vehicle || "N/A",
    rideNotes: ride.rideNotes || ride.RideNotes || "N/A",
    RideNotes: ride.rideNotes || ride.RideNotes || "N/A",
    createdBy: ride.createdBy || ride.CreatedBy || "N/A",
    CreatedBy: ride.createdBy || ride.CreatedBy || "N/A",
    lastModifiedBy: ride.lastModifiedBy || ride.LastModifiedBy || "N/A",
    LastModifiedBy: ride.lastModifiedBy || ride.LastModifiedBy || "N/A",
    claimedBy: ride.claimedBy || ride.ClaimedBy || null,
    ClaimedBy: ride.claimedBy || ride.ClaimedBy || "N/A",
    claimedAt: claimedDate,
    ClaimedAt: claimedDate
      ? dayjs(claimedDate).tz(TIMEZONE).format("MM/DD/YYYY h:mm A")
      : "N/A",
  };
};

// Map Firestore documents to normalized objects
const mapDoc = (d) => normalizeRideData({ id: d.id, ...d.data() });

const buildKey = (col, filters) => `${col}:${JSON.stringify(filters || {})}`;

// Build a query with optional filters
const buildRideQuery = (col, { driver, day, vehicle, limitCount } = {}) => {
  const constraints = [orderBy("pickupTime", "asc")];
  if (driver) constraints.push(where("claimedBy", "==", driver));
  if (vehicle) constraints.push(where("vehicle", "==", vehicle));
  if (day) {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);
    constraints.push(where("pickupTime", ">=", Timestamp.fromDate(start)));
    constraints.push(where("pickupTime", "<=", Timestamp.fromDate(end)));
  }
  if (limitCount) constraints.push(limit(limitCount));
  return query(collection(db, col), ...constraints);
};

// ---------- Live Rides ----------
export const subscribeLiveRides = (callback, filters, onError) =>
  subscribeFirestore(
    buildKey(COLLECTIONS.LIVE_RIDES, filters),
    buildRideQuery(COLLECTIONS.LIVE_RIDES, filters),
    (snap) => callback(snap.docs.map(mapDoc)),
    onError,
  );

export const getLiveRides = async (filters) => {
  const snap = await getDocs(buildRideQuery(COLLECTIONS.LIVE_RIDES, filters));
  return snap.docs.map(mapDoc);
};

export const addLiveRide = async (ride) =>
  addDoc(collection(db, COLLECTIONS.LIVE_RIDES), prepareRideData(ride));

export const deleteLiveRide = async (id) =>
  deleteDoc(doc(db, COLLECTIONS.LIVE_RIDES, id));

export const restoreLiveRide = async (ride) => addLiveRide(ride);

// ---------- Ride Queue ----------
export const subscribeRideQueue = (callback, filters, onError) =>
  subscribeFirestore(
    buildKey(COLLECTIONS.RIDE_QUEUE, filters),
    buildRideQuery(COLLECTIONS.RIDE_QUEUE, filters),
    (snap) => callback(snap.docs.map(mapDoc)),
    onError,
  );

export const getRideQueue = async (filters) => {
  const snap = await getDocs(buildRideQuery(COLLECTIONS.RIDE_QUEUE, filters));
  return snap.docs.map(mapDoc);
};

export const addRideToQueue = async (ride) =>
  addDoc(collection(db, COLLECTIONS.RIDE_QUEUE), prepareRideData(ride));

export const deleteRideFromQueue = async (id) =>
  deleteDoc(doc(db, COLLECTIONS.RIDE_QUEUE, id));

// ---------- Claimed Rides ----------
export const subscribeClaimedRides = (callback, filters, onError) =>
  subscribeFirestore(
    buildKey(COLLECTIONS.CLAIMED_RIDES, filters),
    buildRideQuery(COLLECTIONS.CLAIMED_RIDES, filters),
    (snap) => callback(snap.docs.map(mapDoc)),
    onError,
  );

export const getClaimedRides = async (filters) => {
  const snap = await getDocs(
    buildRideQuery(COLLECTIONS.CLAIMED_RIDES, filters),
  );
  return snap.docs.map(mapDoc);
};

export const deleteClaimedRide = async (id) =>
  deleteDoc(doc(db, COLLECTIONS.CLAIMED_RIDES, id));

// Restore a ride back to the queue
export const restoreRide = async (ride) => addRideToQueue(ride);
