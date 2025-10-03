/* LRP Portal enhancement: FS service shim (Phase-1), 2025-10-03. */
import { serverTimestamp, Timestamp } from "firebase/firestore";

import {
  getDb,
  collection,
  doc,
  getDoc,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  limit,
} from "../firestoreCore";
import { withExponentialBackoff } from "../retry";
import { AppError, logError } from "../errors";

/** ---- Tickets ---- */
const TICKETS = "tickets";

export async function getTicketById(ticketId) {
  if (!ticketId) throw new AppError("ticketId required", { code: "bad_args" });
  const db = getDb();
  const ref = doc(db, TICKETS, ticketId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const rawData = typeof snap.data === "function" ? snap.data() : {};
  const { id: legacyId, ...rest } = rawData || {};
  return {
    id: snap.id,
    docId: snap.id,
    logicalId: legacyId ?? null,
    ...rest,
  };
}

export function subscribeTickets({ q = null, onData, onError } = {}) {
  const db = getDb();
  const baseRef = collection(db, TICKETS);
  const compiled = q || query(baseRef, orderBy("createdAt", "desc"));
  const unsub = onSnapshot(
    compiled,
    (qs) => {
      const rows = qs.docs.map((d) => {
        const data = typeof d.data === "function" ? d.data() : {};
        const { id: legacyId, ...rest } = data || {};
        return {
          id: d.id,
          docId: d.id,
          logicalId: legacyId ?? null,
          ...rest,
        };
      });
      if (onData) onData(rows);
    },
    (err) => {
      logError(err, { where: "subscribeTickets" });
      if (onError) onError(err);
    },
  );
  return unsub;
}

export async function deleteTicketsBatch(ids = []) {
  if (!Array.isArray(ids) || !ids.length) return;
  const db = getDb();
  await withExponentialBackoff(async () => {
    const batch = writeBatch(db);
    ids.forEach((id) => {
      if (!id) return;
      batch.delete(doc(db, TICKETS, id));
    });
    await batch.commit();
  });
}

/** Re-create docs from captured snapshots (for true Undo) */
export async function restoreTicketsBatch(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return;
  const db = getDb();
  await withExponentialBackoff(async () => {
    const batch = writeBatch(db);
    rows.forEach((r) => {
      const { id, ...data } = r || {};
      if (!id) return;
      batch.set(doc(db, TICKETS, id), data, { merge: true });
    });
    await batch.commit();
  });
}

/** ---- TimeLogs ---- */
const TIME_LOGS = "timeLogs";

/* FIX: row.id now always equals Firestore doc id; legacy id kept as logicalId */
function mapTimeLogDoc(docSnap) {
  const rawData =
    docSnap && typeof docSnap.data === "function" ? docSnap.data() : {};
  const { id: legacyId, ...rest } = rawData || {};
  const docId = docSnap?.id || null;
  return {
    id: docId,
    docId,
    logicalId: legacyId ?? null,
    originalId: legacyId ?? null,
    ...rest,
  };
}

function toMillis(value) {
  if (value == null) return -Infinity;
  try {
    if (typeof value.toMillis === "function") {
      return value.toMillis();
    }
    if (value instanceof Timestamp) {
      return value.toMillis();
    }
    if (value instanceof Date) {
      const ms = value.getTime();
      return Number.isFinite(ms) ? ms : -Infinity;
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : -Infinity;
    }
    if (typeof value === "object" && Number.isFinite(value?.seconds)) {
      const seconds = Number(value.seconds) * 1000;
      const nanos = Number.isFinite(value.nanoseconds)
        ? Number(value.nanoseconds) / 1e6
        : 0;
      return seconds + nanos;
    }
  } catch (error) {
    logError(error, { where: "services.fs.toMillis" });
  }
  return -Infinity;
}

function deriveSortMs(row) {
  const candidate =
    row?.startTime ?? row?.clockIn ?? row?.loggedAt ?? row?.createdAt ?? null;
  return toMillis(candidate);
}

function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

function coerceTimestamp(input, { allowNull = true, fallback = null } = {}) {
  if (input === undefined) return undefined;
  if (input === null) return allowNull ? null : (fallback ?? null);

  if (input === "server" || input === "now") {
    return serverTimestamp();
  }

  if (input instanceof Timestamp) {
    return input;
  }

  if (typeof input?.toDate === "function") {
    try {
      const dateValue = input.toDate();
      if (dateValue instanceof Date && Number.isFinite(dateValue.getTime())) {
        return Timestamp.fromDate(dateValue);
      }
    } catch (error) {
      logError(error, { where: "services.fs.coerceTimestamp.toDate" });
    }
  }

  if (input instanceof Date) {
    const ms = input.getTime();
    if (Number.isFinite(ms)) {
      return Timestamp.fromMillis(ms);
    }
    return allowNull ? null : (fallback ?? null);
  }

  if (typeof input === "number") {
    if (Number.isFinite(input)) {
      return Timestamp.fromMillis(input);
    }
    return allowNull ? null : (fallback ?? null);
  }

  if (
    typeof input === "object" &&
    input !== null &&
    Number.isFinite(input.seconds)
  ) {
    const seconds = Number(input.seconds);
    const nanoseconds = Number.isFinite(input.nanoseconds)
      ? Number(input.nanoseconds)
      : 0;
    return new Timestamp(seconds, nanoseconds);
  }

  if (typeof input === "string") {
    const parsed = Date.parse(input);
    if (Number.isFinite(parsed)) {
      return Timestamp.fromMillis(parsed);
    }
    if (input.toLowerCase() === "null") {
      return allowNull ? null : (fallback ?? null);
    }
  }

  return allowNull ? null : (fallback ?? null);
}

function scrubPayload(data) {
  const result = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined) return;
    result[key] = value;
  });
  return result;
}

function computeDurationMinutes(startTs, endTs) {
  const startMs = startTs?.toMillis?.();
  const endMs = endTs?.toMillis?.();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  const diff = endMs - startMs;
  if (!Number.isFinite(diff) || diff <= 0) return null;
  return Math.floor(diff / 60000);
}

export async function logTime(entry = {}) {
  if (!entry || typeof entry !== "object") {
    throw new AppError("logTime: entry required", { code: "bad_args" });
  }

  const driverIdRaw = entry.driverId ?? entry.userId ?? entry.uid ?? null;
  const driverId = driverIdRaw ? String(driverIdRaw).trim() : null;
  if (!driverId) {
    throw new AppError("logTime: driverId required", { code: "bad_args" });
  }

  const driverName = entry.driverName ?? entry.driver ?? null;
  const driverEmail = normalizeEmail(entry.driverEmail ?? entry.userEmail);
  const rideId = entry.rideId ? String(entry.rideId).trim() : "N/A";
  const mode = entry.mode ? String(entry.mode).trim() : "RIDE";

  const baseTimestamps = {
    startTime: coerceTimestamp(entry.startTime, {
      allowNull: false,
      fallback: serverTimestamp(),
    }),
    endTime: coerceTimestamp(entry.endTime, { allowNull: true }),
    loggedAt: coerceTimestamp(entry.loggedAt, {
      allowNull: false,
      fallback: serverTimestamp(),
    }),
    updatedAt: coerceTimestamp(entry.updatedAt, {
      allowNull: false,
      fallback: serverTimestamp(),
    }),
  };

  const durationMinutes = Number.isFinite(entry.duration)
    ? Math.max(0, Math.floor(Number(entry.duration)))
    : null;

  const payload = scrubPayload({
    driverId,
    userId: entry.userId ?? driverId,
    driverName: driverName ?? null,
    driverEmail,
    userEmail: driverEmail,
    rideId,
    mode,
    note: entry.note ?? null,
    startTime: baseTimestamps.startTime,
    endTime: baseTimestamps.endTime ?? null,
    loggedAt: baseTimestamps.loggedAt,
    updatedAt: baseTimestamps.updatedAt,
    duration: durationMinutes,
    source: entry.source ?? null,
  });

  const id =
    typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : null;
  const db = getDb();

  try {
    const resultId = await withExponentialBackoff(async () => {
      if (id) {
        await setDoc(doc(db, TIME_LOGS, id), payload, { merge: true });
        return id;
      }
      const ref = await addDoc(collection(db, TIME_LOGS), payload);
      return ref.id;
    });
    return { id: resultId, docId: resultId };
  } catch (error) {
    logError(error, { where: "services.fs.logTime", driverId });
    throw new AppError("Failed to log time", {
      code: "time_logs/log_failure",
      cause: error,
    });
  }
}

export function subscribeTimeLogs({
  onData,
  onError,
  driverId = null,
  rideId = null,
  limit: limitCount = 200,
} = {}) {
  const db = getDb();
  try {
    const baseRef = collection(db, TIME_LOGS);
    const driverKeys = new Set();
    if (Array.isArray(driverId)) {
      driverId.forEach((value) => {
        const trimmed = value == null ? "" : String(value).trim();
        if (trimmed) driverKeys.add(trimmed);
      });
    } else if (driverId != null) {
      const trimmed = String(driverId).trim();
      if (trimmed) driverKeys.add(trimmed);
    }

    const limitValue = Number.isFinite(limitCount)
      ? limitCount
      : Number.isFinite(Number(limitCount))
        ? Number(limitCount)
        : NaN;
    const hasLimit = Number.isFinite(limitValue) && limitValue > 0;

    const emitRows = (map) => {
      if (typeof onData !== "function") return;
      const rows = Array.from(map.values()).sort(
        (a, b) => deriveSortMs(b) - deriveSortMs(a),
      );
      const limited = hasLimit ? rows.slice(0, limitValue) : rows;
      onData(limited);
    };

    if (driverKeys.size === 0) {
      const constraints = [];
      if (rideId) {
        constraints.push(where("rideId", "==", rideId));
      }
      constraints.push(orderBy("startTime", "desc"));
      if (hasLimit) {
        constraints.push(limit(limitValue));
      }

      const compiledQuery = query(baseRef, ...constraints);
      return onSnapshot(
        compiledQuery,
        (snapshot) => {
          const rows = snapshot.docs.map((docSnap) => mapTimeLogDoc(docSnap));
          if (typeof onData === "function") {
            onData(rows);
          }
        },
        (error) => {
          logError(error, { where: "services.fs.subscribeTimeLogs" });
          if (typeof onError === "function") {
            onError(error);
          }
        },
      );
    }

    /* FIX: broaden timeLogs subscription to OR across legacy id/email fields; dedupe by doc.id */
    const unsubs = [];
    const accumulator = new Map();
    const fields = ["driverId", "userId", "driverEmail", "userEmail"];
    const comboSeen = new Set();

    const attachListener = (field, value) => {
      const comboKey = `${field}::${value}`;
      if (comboSeen.has(comboKey)) return;
      comboSeen.add(comboKey);
      try {
        const clauses = [where(field, "==", value)];
        if (rideId) {
          clauses.push(where("rideId", "==", rideId));
        }
        clauses.push(orderBy("startTime", "desc"));
        if (hasLimit) {
          clauses.push(limit(limitValue));
        }
        const qref = query(baseRef, ...clauses);
        const unsub = onSnapshot(
          qref,
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === "removed") {
                accumulator.delete(change.doc.id);
                return;
              }
              accumulator.set(change.doc.id, mapTimeLogDoc(change.doc));
            });
            emitRows(accumulator);
          },
          (error) => {
            logError(error, {
              where: "services.fs.subscribeTimeLogs.listener",
              field,
              value,
            });
            if (typeof onError === "function") {
              onError(error);
            }
          },
        );
        unsubs.push(unsub);
      } catch (error) {
        logError(error, {
          where: "services.fs.subscribeTimeLogs.buildQuery",
          field,
          value,
        });
      }
    };

    driverKeys.forEach((value) => {
      fields.forEach((field) => attachListener(field, value));
    });

    emitRows(accumulator);

    return () => {
      unsubs.forEach((unsub) => {
        try {
          if (typeof unsub === "function") unsub();
        } catch (error) {
          logError(error, { where: "services.fs.subscribeTimeLogs.cleanup" });
        }
      });
    };
  } catch (error) {
    logError(error, {
      where: "services.fs.subscribeTimeLogs",
      driverId,
      rideId,
    });
    if (typeof onError === "function") {
      onError(error);
    }
    return () => {};
  }
}

export async function deleteTimeLog(id) {
  if (!id) return;
  const db = getDb();
  try {
    await withExponentialBackoff(async () => {
      await deleteDoc(doc(db, TIME_LOGS, id));
    });
  } catch (error) {
    logError(error, { where: "services.fs.deleteTimeLog", id });
    throw new AppError("Failed to delete time log", {
      code: "time_logs/delete_failure",
      cause: error,
    });
  }
}

export async function updateTimeLog(id, data = {}) {
  if (!id) {
    throw new AppError("updateTimeLog: id required", { code: "bad_args" });
  }
  if (!data || typeof data !== "object") return;

  const db = getDb();
  const ref = doc(db, TIME_LOGS, id);

  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(data, key);

  const payload = {};

  if (hasOwn("driver")) payload.driver = data.driver ?? null;
  if (hasOwn("driverId")) payload.driverId = data.driverId ?? null;
  if (hasOwn("driverName")) payload.driverName = data.driverName ?? null;
  if (hasOwn("rideId")) payload.rideId = data.rideId ?? null;
  if (hasOwn("mode")) payload.mode = data.mode ?? null;
  if (hasOwn("note")) payload.note = data.note ?? null;
  if (hasOwn("userId")) payload.userId = data.userId ?? null;

  if (hasOwn("driverEmail")) {
    payload.driverEmail = normalizeEmail(data.driverEmail);
  }
  if (hasOwn("userEmail")) {
    payload.userEmail = normalizeEmail(data.userEmail);
  }

  if (hasOwn("duration")) {
    const duration = Number(data.duration);
    if (Number.isFinite(duration) && duration >= 0) {
      payload.duration = Math.floor(duration);
    } else if (data.duration === null) {
      payload.duration = null;
    }
  }

  if (hasOwn("startTime")) {
    const next = coerceTimestamp(data.startTime, {
      allowNull: true,
      fallback: null,
    });
    payload.startTime = next ?? null;
  }

  if (hasOwn("endTime")) {
    const next = coerceTimestamp(data.endTime, {
      allowNull: true,
      fallback: null,
    });
    payload.endTime = next ?? null;
  }

  if (hasOwn("loggedAt")) {
    const next = coerceTimestamp(data.loggedAt, {
      allowNull: true,
      fallback: null,
    });
    payload.loggedAt = next ?? null;
  }

  payload.updatedAt = coerceTimestamp(data.updatedAt, {
    allowNull: false,
    fallback: serverTimestamp(),
  });

  let startTs = hasOwn("startTime") ? payload.startTime : undefined;
  let endTs = hasOwn("endTime") ? payload.endTime : undefined;

  if (hasOwn("startTime") || hasOwn("endTime")) {
    try {
      if (startTs === undefined || endTs === undefined) {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const existing = snap.data();
          if (startTs === undefined) startTs = existing?.startTime ?? null;
          if (endTs === undefined) endTs = existing?.endTime ?? null;
        }
      }
    } catch (error) {
      logError(error, { where: "services.fs.updateTimeLog.fetch", id });
    }

    const computedDuration = computeDurationMinutes(startTs, endTs);
    payload.duration = computedDuration;
  }

  const cleaned = scrubPayload(payload);

  if (Object.keys(cleaned).length === 0) {
    return;
  }

  try {
    await withExponentialBackoff(async () => {
      await updateDoc(ref, cleaned);
    });
  } catch (error) {
    logError(error, { where: "services.fs.updateTimeLog", id });
    throw new AppError("Failed to update time log", {
      code: "time_logs/update_failure",
      cause: error,
    });
  }
}

export const timeLogs = {
  logTime,
  subscribeTimeLogs,
  deleteTimeLog,
  updateTimeLog,
};
