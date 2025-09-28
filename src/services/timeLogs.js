/* Proprietary and confidential. See LICENSE. */
// src/services/timeLogs.js
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  limit as limitDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { dayjs } from "@/utils/time";

import logError from "../utils/logError.js";

import { mapSnapshotToRows } from "./normalizers";

const db = getFirestore();

function backoff(attempt) {
  return new Promise((res) => setTimeout(res, 2 ** attempt * 100));
}

function normalizeTimestampInput(value) {
  if (value == null) return null;
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (typeof value === "number" && Number.isFinite(value)) {
    return Timestamp.fromMillis(value);
  }
  if (typeof value?.toDate === "function") {
    try {
      const date = value.toDate();
      if (date instanceof Date) return Timestamp.fromDate(date);
    } catch (error) {
      logError(error, { where: "timeLogs.normalizeTimestampInput" });
    }
  }
  return null;
}

export function subscribeMyTimeLogs({
  user,
  onData,
  onError,
  limitDays = 30,
} = {}) {
  if (!user?.uid && !user?.email) {
    onData?.([]);
    return () => {};
  }

  try {
    const clauses = [];
    if (user?.uid) {
      clauses.push(where("driverId", "==", user.uid));
    } else if (user?.email) {
      const email =
        typeof user.email === "string" ? user.email.toLowerCase() : user.email;
      if (email) clauses.push(where("driverEmail", "==", email));
    }

    const constraints = [...clauses];
    if (Number.isFinite(limitDays) && limitDays > 0) {
      const bound = dayjs().subtract(limitDays, "day").startOf("day");
      if (bound?.isValid?.()) {
        constraints.push(
          where("startTime", ">=", Timestamp.fromDate(bound.toDate())),
        );
      }
    }

    constraints.push(orderBy("startTime", "desc"));
    constraints.push(limitDocs(200));

    const q = query(collection(db, "timeLogs"), ...constraints);
    return onSnapshot(
      q,
      (snap) => {
        const rows = [];
        snap.forEach((docSnap) => {
          rows.push({ id: docSnap.id, ...docSnap.data() });
        });
        onData?.(rows);
      },
      (error) => {
        logError(error, { where: "timeLogs.subscribeMyTimeLogs" });
        onError?.(error);
      },
    );
  } catch (error) {
    logError(error, { where: "timeLogs.subscribeMyTimeLogs" });
    onError?.(error);
    onData?.([]);
    return () => {};
  }
}

export async function startTimeLog({
  user,
  rideId = "N/A",
  mode = "N/A",
  startTime = null,
} = {}) {
  if (!user) throw new Error("No user");

  const email =
    typeof user.email === "string" ? user.email.toLowerCase() : user.email;
  const displayName = user.displayName || user.email || "Unknown";
  const normalizedMode =
    typeof mode === "string" && mode.trim() ? mode.trim().toUpperCase() : "N/A";
  const normalizedRideId =
    normalizedMode === "RIDE" ? rideId || "N/A" : (rideId ?? null);

  const startValue = normalizeTimestampInput(startTime) || serverTimestamp();
  const now = serverTimestamp();

  try {
    const ref = await addDoc(collection(db, "timeLogs"), {
      driverId: user.uid || null,
      userId: user.uid || null,
      driverEmail: email || null,
      userEmail: email || null,
      driverName: displayName || "Unknown",
      rideId: normalizedRideId,
      mode: normalizedMode,
      startTime: startValue,
      endTime: null,
      createdAt: now,
      updatedAt: now,
      loggedAt: now,
    });
    return ref.id;
  } catch (error) {
    logError(error, { where: "timeLogs.startTimeLog" });
    throw error;
  }
}

export async function endTimeLog({ id, endTime = null, rideId, mode } = {}) {
  if (!id) throw new Error("Missing timeLog id");

  const updates = {
    endTime: normalizeTimestampInput(endTime) || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (rideId !== undefined) updates.rideId = rideId ?? null;
  if (mode !== undefined) updates.mode = mode ?? null;

  try {
    await updateDoc(doc(db, "timeLogs", id), updates);
  } catch (error) {
    logError(error, { where: "timeLogs.endTimeLog", id });
    throw error;
  }
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
  const user = {
    uid: payload.userId ?? payload.uid ?? payload.driverId ?? null,
    email: payload.driverEmail ?? payload.userEmail ?? null,
    displayName: payload.driverName ?? null,
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const id = await startTimeLog({
        user,
        rideId: payload.rideId ?? "N/A",
        mode: payload.mode ?? "RIDE",
        startTime: payload.startTime ?? null,
      });
      return { id };
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

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await endTimeLog({ id, ...options });
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
