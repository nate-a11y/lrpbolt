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
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// Normalize incoming ride data to Firestore-ready structure
const normalizeRideData = (ride) => {
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

// Map Firestore documents to plain objects with IDs
const mapDoc = (d) => ({ id: d.id, ...d.data() });

// Build a query with optional filters
const buildRideQuery = (
  col,
  { driver, day, vehicle, limitCount } = {},
) => {
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
export const subscribeLiveRides = (callback, filters) =>
  onSnapshot(
    buildRideQuery("liveRides", filters),
    (snap) => callback(snap.docs.map(mapDoc)),
    (err) => {
      console.error("subscribeLiveRides", err);
      callback([]);
    },
  );

export const getLiveRides = async (filters) => {
  const snap = await getDocs(buildRideQuery("liveRides", filters));
  return snap.docs.map(mapDoc);
};

export const addLiveRide = async (ride) =>
  addDoc(collection(db, "liveRides"), normalizeRideData(ride));

export const deleteLiveRide = async (id) =>
  deleteDoc(doc(db, "liveRides", id));

export const restoreLiveRide = async (ride) => addLiveRide(ride);

// ---------- Ride Queue ----------
export const subscribeRideQueue = (callback, filters) =>
  onSnapshot(
    buildRideQuery("rideQueue", filters),
    (snap) => callback(snap.docs.map(mapDoc)),
    (err) => {
      console.error("subscribeRideQueue", err);
      callback([]);
    },
  );

export const getRideQueue = async (filters) => {
  const snap = await getDocs(buildRideQuery("rideQueue", filters));
  return snap.docs.map(mapDoc);
};

export const addRideToQueue = async (ride) =>
  addDoc(collection(db, "rideQueue"), normalizeRideData(ride));

export const deleteRideFromQueue = async (id) =>
  deleteDoc(doc(db, "rideQueue", id));

// ---------- Claimed Rides ----------
export const subscribeClaimedRides = (callback, filters) =>
  onSnapshot(
    buildRideQuery("claimedRides", filters),
    (snap) => callback(snap.docs.map(mapDoc)),
    (err) => {
      console.error("subscribeClaimedRides", err);
      callback([]);
    },
  );

export const getClaimedRides = async (filters) => {
  const snap = await getDocs(buildRideQuery("claimedRides", filters));
  return snap.docs.map(mapDoc);
};

export const deleteClaimedRide = async (id) =>
  deleteDoc(doc(db, "claimedRides", id));

// Restore a ride back to the queue
export const restoreRide = async (ride) => addRideToQueue(ride);
