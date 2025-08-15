// src/services/firestoreService.js
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import { TIMEZONE } from "../constants";
import { db } from "../utils/firebaseInit";
import { logError } from "../utils/logError";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);

// Convert Firestore ride document into UI-friendly structure
function normalizeRideData(ride) {
  const tripId = ride.tripId || ride.TripID || ride.id;
  const pickupTs = ride.pickupTime || ride.PickupTime;
  const claimedTs = ride.claimedAt || ride.ClaimedAt;
  let pickupDate = null;
  let claimedDate = null;
  if (pickupTs instanceof Timestamp) pickupDate = pickupTs.toDate();
  else if (pickupTs) pickupDate = new Date(pickupTs);
  if (claimedTs instanceof Timestamp) claimedDate = claimedTs.toDate();
  else if (claimedTs) claimedDate = new Date(claimedTs);
  const durationMinutes =
    ride.rideDuration !== undefined ? ride.rideDuration : ride.RideDuration;
  const formattedDuration =
    typeof durationMinutes === "number"
      ? dayjs.duration(durationMinutes, "minutes").format("HH:mm")
      : ride.RideDuration || "N/A";

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
}

const mapDoc = (d) => normalizeRideData({ id: d.id, ...d.data() });

export async function getRides(collectionName) {
  try {
    const q = query(collection(db, collectionName), orderBy("pickupTime", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map(mapDoc).filter(Boolean);
  } catch (err) {
    logError(err, `getRides:${collectionName}`);
    return [];
  }
}

export function subscribeRides(collectionName, callback, onError) {
  try {
    const q = query(collection(db, collectionName), orderBy("pickupTime", "asc"));
    return onSnapshot(
      q,
      (snap) => callback(snap.docs.map(mapDoc).filter(Boolean)),
      (err) => {
        logError(err, `subscribeRides:${collectionName}`);
        onError?.(err);
      },
    );
  } catch (err) {
    logError(err, `subscribeRidesInit:${collectionName}`);
    onError?.(err);
    return () => {};
  }
}

export async function updateRide(collectionName, docId, data) {
  const ref = doc(db, collectionName, docId);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const snap = await getDoc(ref);
      const payload = { ...data, updatedAt: serverTimestamp() };
      if (!snap.exists()) {
        console.warn(
          `updateRide: ${collectionName}/${docId} does not exist. Creating new document.`,
        );
        await setDoc(
          ref,
          { ...payload, createdAt: serverTimestamp() },
          { merge: true },
        );
      } else {
        await setDoc(ref, payload, { merge: true });
      }
      return { success: true };
    } catch (err) {
      if (attempt === 3) {
        logError(err, `updateRide:${collectionName}/${docId}`);
        throw err;
      }
    }
  }
  return { success: false };
}

export async function deleteRide(collectionName, docId) {
  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (err) {
    logError(err, `deleteRide:${collectionName}/${docId}`);
    throw err;
  }
}

