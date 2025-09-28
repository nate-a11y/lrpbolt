/* Proprietary and confidential. See LICENSE. */
// src/services/timeLogs.js
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit as limitDocs,
  onSnapshot,
  or,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../utils/firebaseInit";
import logError from "../utils/logError.js";

import { mapSnapshotToRows } from "./normalizers";

export function subscribeMyTimeLogs({ user, onData, onError }) {
  if (!user) {
    const err = new Error("Missing user for subscribeMyTimeLogs");
    logError(err, { where: "timeLogs.subscribeMyTimeLogs", reason: "no-user" });
    if (onError) onError(err);
    return () => {};
  }

  const ref = collection(db, "timeLogs");
  const seen = new Set();
  const identityFilters = [];

  const addFilter = (field, value) => {
    if (!value) return;
    const key = `${field}:${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    identityFilters.push(where(field, "==", value));
  };

  addFilter("driverId", user?.displayName);
  addFilter("driverId", user?.uid);
  addFilter("userId", user?.uid);
  addFilter("driverEmail", user?.email);
  addFilter("userEmail", user?.email);

  if (identityFilters.length === 0) {
    const err = new Error("Missing user identity for subscribeMyTimeLogs");
    logError(err, {
      where: "timeLogs.subscribeMyTimeLogs",
      reason: "no-identity",
    });
    if (onError) onError(err);
    return () => {};
  }

  const ordering = orderBy("startTime", "desc");

  try {
    const q =
      identityFilters.length === 1
        ? query(ref, identityFilters[0], ordering)
        : query(ref, or(...identityFilters), ordering);
    return onSnapshot(
      q,
      (snap) => {
        const rows = [];
        snap.forEach((docSnap) => {
          rows.push({ id: docSnap.id, ...docSnap.data() });
        });
        onData?.(rows);
      },
      (err) => {
        logError(err, { where: "timeLogs.subscribeMyTimeLogs" });
        onError?.(err);
      },
    );
  } catch (err) {
    logError(err, { where: "timeLogs.subscribeMyTimeLogs", stage: "query" });
    onError?.(err);
    return () => {};
  }
}

export async function startTimeLog({ user, rideId = "N/A", mode = "N/A" }) {
  if (!user) throw new Error("No user");

  const payload = {
    driverId: user.displayName || "Unknown",
    driverName: user.displayName || "Unknown",
    driverEmail: user.email || null,
    rideId: rideId || "N/A",
    mode: mode || "N/A",
    startTime: serverTimestamp(),
    endTime: null,
    loggedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    userEmail: user.email || null,
  };

  const ref = await addDoc(collection(db, "timeLogs"), payload);
  return ref.id;
}

export async function endTimeLog({ id }) {
  if (!id) throw new Error("Missing timeLog id");

  await updateDoc(doc(db, "timeLogs", id), {
    endTime: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

function backoff(attempt) {
  return new Promise((res) => setTimeout(res, 2 ** attempt * 100));
}

export async function patchTimeLog(id, updates = {}) {
  if (!id) return;
  const ref = doc(db, "timeLogs", id);
  const coerceTs = (v) =>
    v == null
      ? null
      : v instanceof Timestamp
        ? v
        : Timestamp.fromMillis(Number(v));

  const data = {};
  if ("driver" in updates) data.driver = updates.driver;
  if ("driverName" in updates) data.driverName = updates.driverName;
  if ("rideId" in updates) data.rideId = updates.rideId;
  if ("note" in updates) data.note = updates.note;
  if ("startTime" in updates) data.startTime = coerceTs(updates.startTime);
  if ("endTime" in updates) data.endTime = coerceTs(updates.endTime);
  if ("loggedAt" in updates) data.loggedAt = coerceTs(updates.loggedAt);
  if ("duration" in updates) data.duration = Number(updates.duration) || 0;

  const s = data.startTime?.toMillis?.();
  const e = data.endTime?.toMillis?.();
  if (Number.isFinite(s) && Number.isFinite(e) && e >= s) {
    data.duration = Math.floor((e - s) / 60000);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await updateDoc(ref, data);
      return;
    } catch (err) {
      if (attempt === 2) {
        logError(err, `patchTimeLog:${id}`);
        throw err;
      }
      await backoff(attempt);
    }
  }
}

export async function deleteTimeLog(id) {
  if (!id) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await deleteDoc(doc(db, "timeLogs", id));
      return;
    } catch (err) {
      if (attempt === 2) {
        logError(err, `deleteTimeLog:${id}`);
        throw err;
      }
      await backoff(attempt);
    }
  }
}

export async function createTimeLog(data) {
  if (!data) return;
  const id = data.id;
  const payload = { ...data };
  delete payload.id;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ref = id
        ? doc(db, "timeLogs", id)
        : doc(collection(db, "timeLogs"));
      await setDoc(ref, payload);
      return ref.id;
    } catch (err) {
      if (attempt === 2) {
        logError(err, `createTimeLog:${id || "new"}`);
        throw err;
      }
      await backoff(attempt);
    }
  }
}

export function subscribeTimeLogs(arg1, arg2, arg3) {
  let criteria = {};
  let onNext = null;
  let onError = null;

  if (typeof arg1 === "function") {
    onNext = arg1;
    onError = typeof arg2 === "function" ? arg2 : null;
    criteria = arg3 || {};
  } else {
    criteria = arg1 || {};
    onNext = typeof arg2 === "function" ? arg2 : null;
    onError = typeof arg3 === "function" ? arg3 : null;
  }

  try {
    const { driverEmail = null, userId = null, limit = 200 } = criteria || {};
    const constraints = [];
    if (userId) {
      constraints.push(where("userId", "==", userId));
    } else if (driverEmail) {
      const emailFilter = String(driverEmail).toLowerCase();
      constraints.push(where("userEmail", "==", emailFilter));
    }
    constraints.push(orderBy("startTime", "desc"));
    if (Number.isFinite(limit) && limit > 0) {
      constraints.push(limitDocs(limit));
    }
    const q = query(collection(db, "timeLogs"), ...constraints);
    return onSnapshot(
      q,
      (snap) => {
        const rows = mapSnapshotToRows("timeLogs", snap).map((row) => {
          const email = row?.driverEmail || row?.userEmail || "";
          const derivedUserId =
            row?.userId || row?.driverId || row?.uid || null;
          const driverName =
            row?.driverName ||
            row?.driver ||
            row?.displayName ||
            row?.name ||
            (typeof email === "string" && email.includes("@")
              ? email.split("@")[0]
              : email) ||
            "";
          return {
            ...row,
            id:
              row?.id ||
              row?.docId ||
              row?._id ||
              `${derivedUserId || email || "unknown"}-${
                row?.startTime?.seconds ?? row?.startTime ?? "start"
              }`,
            userId: derivedUserId,
            driverName: driverName || null,
            startTime: row?.startTime ?? null,
            endTime: row?.endTime ?? null,
          };
        });
        onNext?.(rows);
      },
      (err) => {
        logError(err, { where: "timeLogs.subscribeTimeLogs", criteria });
        onError?.(err);
      },
    );
  } catch (err) {
    logError(err, { where: "timeLogs.subscribeTimeLogs", criteria });
    onError?.(err);
    return () => {};
  }
}

export async function logTime(payload = {}) {
  const driverEmail = payload.driverEmail?.toLowerCase?.() || null;
  const base = {
    driverId: payload.driverId ?? null,
    driverEmail,
    userEmail: driverEmail,
    userId: payload.userId ?? payload.uid ?? null,
    driverName: payload.driverName ?? null,
    rideId: payload.rideId ?? null,
    mode: payload.mode ?? "RIDE",
    startTime:
      payload.startTime instanceof Timestamp
        ? payload.startTime
        : serverTimestamp(),
    endTime: payload.endTime ?? null,
    loggedAt: serverTimestamp(),
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ref = await addDoc(collection(db, "timeLogs"), base);
      return { id: ref.id };
    } catch (err) {
      if (attempt === 2) {
        logError(err, { where: "timeLogs.logTime", payload });
        throw err;
      }
      await backoff(attempt);
    }
  }
  return null;
}

export async function endSession(id, options = {}) {
  if (!id) return;
  const ref = doc(db, "timeLogs", id);
  const { endTime, rideId, mode } = options || {};
  let endValue = endTime;
  if (endValue == null) {
    endValue = null;
  } else if (endValue instanceof Timestamp) {
    // already Timestamp
  } else if (typeof endValue?.toDate === "function") {
    endValue = Timestamp.fromDate(endValue.toDate());
  } else if (typeof endValue === "number") {
    endValue = Timestamp.fromMillis(endValue);
  } else {
    endValue = Timestamp.fromDate(new Date(endValue));
  }

  const updates = {
    endTime: endValue ?? null,
    updatedAt: serverTimestamp(),
  };
  if (rideId !== undefined) updates.rideId = rideId ?? null;
  if (mode !== undefined) updates.mode = mode ?? null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await updateDoc(ref, updates);
      return;
    } catch (err) {
      if (attempt === 2) {
        logError(err, { where: "timeLogs.endSession", id });
        throw err;
      }
      await backoff(attempt);
    }
  }
}
