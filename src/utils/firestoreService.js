import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  limit,
  setDoc,
} from "firebase/firestore";

import { db } from "src/utils/firebaseInit";

import { logError } from "./logError";

/**
 * Normalize a shootoutStats document snapshot.
 * @param {import('firebase/firestore').QueryDocumentSnapshot} doc
 * @returns {object}
 */
function normalizeShootout(doc) {
  const d = doc.data() || {};
  return {
    id: doc.id,
    driverEmail: d.driverEmail || "",
    vehicle: d.vehicle || "",
    startTime: d.startTime || null,
    endTime: d.endTime || null,
    trips: typeof d.trips === "number" ? d.trips : 0,
    passengers: typeof d.passengers === "number" ? d.passengers : 0,
    createdAt: d.createdAt || null,
  };
}

export function subscribeShootoutStats({ driverEmail, onData, onError }) {
  try {
    const base = collection(db, "shootoutStats");
    const q = driverEmail
      ? query(
          base,
          where("driverEmail", "==", driverEmail),
          orderBy("startTime", "desc"),
          limit(200),
        )
      : query(base, orderBy("startTime", "desc"), limit(200));
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map(normalizeShootout);
        onData(rows);
      },
      (err) => {
        logError(err, "FirestoreSubscribe: shootoutStats");
        onError?.(err);
      },
    );
  } catch (e) {
    logError(e, "FirestoreSubscribe: shootoutStats init");
    onError?.(e);
    return () => {};
  }
}

export async function createShootoutSession({ driverEmail, vehicle, startTime }) {
  try {
    const payload = {
      driverEmail,
      vehicle: vehicle || "",
      startTime: startTime instanceof Timestamp ? startTime : Timestamp.fromDate(startTime || new Date()),
      endTime: null,
      trips: 0,
      passengers: 0,
      createdAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, "shootoutStats"), payload);
    return ref.id;
  } catch (e) {
    logError("createShootoutSession", e);
    throw e;
  }
}

export async function updateShootoutSession(id, patch) {
  try {
    const ref = doc(db, "shootoutStats", id);
    const safe = { ...patch };
    if (safe.startTime && !(safe.startTime instanceof Timestamp))
      safe.startTime = Timestamp.fromDate(new Date(safe.startTime));
    if (safe.endTime && !(safe.endTime instanceof Timestamp))
      safe.endTime = Timestamp.fromDate(new Date(safe.endTime));
    await updateDoc(ref, safe);
  } catch (e) {
    logError("updateShootoutSession", e);
    throw e;
  }
}

// Legacy user access helpers (preserved for compatibility)

const COLL = "userAccess";

/**
 * Creates/merges a userAccess doc. Doc ID is the LOWERCASED email.
 * Fields required by rules: name, email, access ("admin" | "driver")
 * Extra fields (active, createdAt/updatedAt) are allowed.
 */
export async function createUser({ name, email, access, active = true }) {
  const lcEmail = (email || "").toLowerCase();
  const lcAccess = (access || "").toLowerCase();
  const ref = doc(db, COLL, lcEmail);
  await setDoc(
    ref,
    {
      name: String(name || "").trim(),
      email: lcEmail,
      access: lcAccess,
      active: Boolean(active),
      createdAt: new Date(),
    },
    { merge: true }
  );
}

export async function updateUser({ email, access, name, active }) {
  const lcEmail = (email || "").toLowerCase();
  const patch = {};
  if (typeof name === "string") patch.name = name.trim();
  if (typeof access === "string") patch.access = access.toLowerCase();
  if (typeof active === "boolean") patch.active = active;
  patch.updatedAt = new Date();
  await updateDoc(doc(db, COLL, lcEmail), patch);
}

