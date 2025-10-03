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

/* LRP Portal hotfix: TimeLogs normalize + write path, 2025-10-03 */
export function normalizeTimeLog(docSnap) {
  const data =
    docSnap && typeof docSnap.data === "function" ? docSnap.data() : {};
  const id = docSnap?.id || null;

  const startTs =
    data?.startTs ||
    data?.startTime ||
    data?.clockInAt ||
    data?.clockIn ||
    data?.start ||
    null;
  const endTs =
    data?.endTs ||
    data?.endTime ||
    data?.clockOutAt ||
    data?.clockOut ||
    data?.end ||
    null;

  const driverEmailRaw =
    data?.driverEmail ?? data?.userEmail ?? data?.email ?? data?.driver ?? null;
  const driverEmail =
    typeof driverEmailRaw === "string"
      ? driverEmailRaw.trim().toLowerCase()
      : (driverEmailRaw ?? null);

  const userEmailRaw = data?.userEmail ?? driverEmailRaw ?? null;
  const userEmail =
    typeof userEmailRaw === "string"
      ? userEmailRaw.trim().toLowerCase()
      : (userEmailRaw ?? null);

  const driverName =
    (typeof data?.driverName === "string" && data.driverName.trim()) ||
    (typeof data?.displayName === "string" && data.displayName.trim()) ||
    (typeof data?.name === "string" && data.name.trim()) ||
    (typeof data?.driver === "string" && data.driver.trim()) ||
    null;

  const driverIdRaw =
    data?.driverId ??
    data?.userId ??
    data?.uid ??
    driverEmail ??
    driverName ??
    null;
  const driverId =
    driverIdRaw != null && driverIdRaw !== undefined
      ? (() => {
          const str = String(driverIdRaw).trim();
          return str || null;
        })()
      : null;

  const driverKey =
    data?.driverKey || driverId || driverEmail || data?.userEmail || null;
  const legacyId = data?.id ?? null;
  const normalizedDriverKey =
    driverKey != null && driverKey !== undefined
      ? (() => {
          const str = String(driverKey).trim();
          return str || null;
        })()
      : null;

  const rideIdRaw =
    data?.rideId ?? data?.ride ?? data?.tripId ?? data?.TripID ?? null;
  const rideId =
    rideIdRaw != null && rideIdRaw !== undefined
      ? (() => {
          const str = String(rideIdRaw).trim();
          return str || "N/A";
        })()
      : "N/A";

  const startTime = data?.startTime ?? startTs ?? null;
  const endTime = data?.endTime ?? endTs ?? null;

  const status =
    data?.status ||
    data?.state ||
    (endTime ? "closed" : startTime ? "open" : null);

  const explicitDuration =
    data?.duration ?? data?.durationMin ?? data?.minutes ?? null;
  const parsedDuration = Number(explicitDuration);
  const normalizedDuration = Number.isFinite(parsedDuration)
    ? Math.max(0, Math.floor(parsedDuration))
    : (computeDurationMinutes(startTime, endTime) ?? null);

  const searchParts = [driverName, driverEmail, userEmail, driverId, rideId]
    .filter((value) => value != null && value !== "")
    .map((value) => String(value).toLowerCase());

  return {
    ...data,
    id,
    docId: id,
    logicalId: legacyId,
    originalId: legacyId,
    startTs: startTs ?? null,
    endTs: endTs ?? null,
    startTime: startTime ?? null,
    endTime: endTime ?? null,
    clockIn: data?.clockIn ?? startTime ?? null,
    clockOut: data?.clockOut ?? endTime ?? null,
    driverKey: normalizedDriverKey,
    driverId,
    driverName,
    driverEmail,
    userEmail,
    rideId,
    duration: normalizedDuration ?? null,
    durationMin: normalizedDuration ?? null,
    status: status || "open",
    _searchText: searchParts.join(" "),
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
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
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
    row?.startTs ??
    row?.startTime ??
    row?.clockIn ??
    row?.clockInAt ??
    row?.loggedAt ??
    row?.createdAt ??
    null;
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

  if (
    typeof input === "object" &&
    input !== null &&
    typeof input._methodName === "string" &&
    input._methodName.toLowerCase().includes("servertimestamp")
  ) {
    return input;
  }

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

  const driverEmail = normalizeEmail(entry.driverEmail ?? entry.userEmail);
  const driverIdRaw = entry.userId ?? entry.driverId ?? entry.uid ?? null;
  const driverId = driverIdRaw ? String(driverIdRaw).trim() : null;

  const driverKeyCandidate = entry.driverKey ?? driverId ?? driverEmail ?? null;

  if (!driverKeyCandidate) {
    throw new AppError("logTime: driverKey required", { code: "bad_args" });
  }

  const driverKey = String(driverKeyCandidate).trim();
  if (!driverKey) {
    throw new AppError("logTime: driverKey required", { code: "bad_args" });
  }

  const modeRaw = entry.mode ? String(entry.mode).trim() : "RIDE";
  const rideRaw = entry.rideId ? String(entry.rideId).trim() : "";
  const mode = modeRaw || "RIDE";
  const rideId = mode === "RIDE" ? rideRaw || "N/A" : "N/A";

  const startInput =
    entry.startTs ??
    entry.startTime ??
    entry.clockInAt ??
    entry.clockIn ??
    entry.start ??
    null;
  const endInput =
    entry.endTs ??
    entry.endTime ??
    entry.clockOutAt ??
    entry.clockOut ??
    entry.end ??
    null;

  let startTs = coerceTimestamp(startInput, {
    allowNull: false,
    fallback: serverTimestamp(),
  });
  if (startTs === undefined || startTs === null) {
    startTs = coerceTimestamp("server", {
      allowNull: false,
      fallback: serverTimestamp(),
    });
  }

  const endTs = coerceTimestamp(endInput, { allowNull: true, fallback: null });

  const loggedAt = coerceTimestamp(entry.loggedAt, {
    allowNull: false,
    fallback: serverTimestamp(),
  });
  const updatedAt = coerceTimestamp(entry.updatedAt, {
    allowNull: false,
    fallback: serverTimestamp(),
  });

  const durationMinutes = Number.isFinite(entry.duration)
    ? Math.max(0, Math.floor(Number(entry.duration)))
    : computeDurationMinutes(startTs, endTs);

  const driverName =
    entry.driverName ||
    entry.displayName ||
    entry.name ||
    entry.driver ||
    (driverEmail && driverEmail.includes("@")
      ? driverEmail.split("@")[0]
      : driverEmail) ||
    null;

  const payload = scrubPayload({
    driverKey,
    driverId: driverId ?? null,
    userId: entry.userId ?? driverId ?? null,
    driverName,
    driverEmail,
    userEmail: driverEmail,
    rideId,
    mode,
    note: entry.note ?? null,
    startTs,
    startTime: startTs,
    endTs: endTs ?? null,
    endTime: endTs ?? null,
    loggedAt,
    updatedAt,
    duration: durationMinutes,
    status: entry.status || (endTs ? "closed" : "open"),
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
    logError(error, { where: "services.fs.logTime", driverKey });
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
  key = null,
  rideId = null,
  limit: limitCount = 200,
} = {}) {
  const db = getDb();
  try {
    const baseRef = collection(db, TIME_LOGS);
    const driverKeys = new Set();

    const pushKey = (value) => {
      if (value == null) return;
      const str = String(value).trim();
      if (!str) return;
      driverKeys.add(str);
      const lower = str.toLowerCase();
      if (lower !== str) {
        driverKeys.add(lower);
      }
      if (str.includes("@")) {
        driverKeys.add(str.toLowerCase());
      }
    };

    const seedKeys = Array.isArray(key) ? key : key != null ? [key] : [];
    seedKeys.forEach((value) => pushKey(value));

    if (Array.isArray(driverId)) {
      driverId.forEach((value) => pushKey(value));
    } else if (driverId != null) {
      pushKey(driverId);
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
          const rows = snapshot.docs.map((docSnap) =>
            normalizeTimeLog(docSnap),
          );
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
    const fields = [
      "driverKey",
      "driverId",
      "userId",
      "driverEmail",
      "userEmail",
    ];
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
              accumulator.set(change.doc.id, normalizeTimeLog(change.doc));
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
  if (hasOwn("driverKey")) payload.driverKey = data.driverKey ?? null;
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

  let nextStartTs;
  let nextStartTime;
  let nextEndTs;
  let nextEndTime;

  if (hasOwn("startTs")) {
    nextStartTs = coerceTimestamp(data.startTs, {
      allowNull: true,
      fallback: null,
    });
  }

  if (hasOwn("startTime")) {
    nextStartTime = coerceTimestamp(data.startTime, {
      allowNull: true,
      fallback: null,
    });
  }

  if (hasOwn("endTs")) {
    nextEndTs = coerceTimestamp(data.endTs, {
      allowNull: true,
      fallback: null,
    });
  }

  if (hasOwn("endTime")) {
    nextEndTime = coerceTimestamp(data.endTime, {
      allowNull: true,
      fallback: null,
    });
  }

  if (nextStartTs === undefined && nextStartTime !== undefined) {
    nextStartTs = nextStartTime;
  }
  if (nextStartTime === undefined && nextStartTs !== undefined) {
    nextStartTime = nextStartTs;
  }
  if (nextEndTs === undefined && nextEndTime !== undefined) {
    nextEndTs = nextEndTime;
  }
  if (nextEndTime === undefined && nextEndTs !== undefined) {
    nextEndTime = nextEndTs;
  }

  if (nextStartTs !== undefined) payload.startTs = nextStartTs ?? null;
  if (nextStartTime !== undefined) payload.startTime = nextStartTime ?? null;
  if (nextEndTs !== undefined) payload.endTs = nextEndTs ?? null;
  if (nextEndTime !== undefined) payload.endTime = nextEndTime ?? null;

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

  let startForDuration =
    nextStartTs !== undefined
      ? nextStartTs
      : nextStartTime !== undefined
        ? nextStartTime
        : undefined;
  let endForDuration =
    nextEndTs !== undefined
      ? nextEndTs
      : nextEndTime !== undefined
        ? nextEndTime
        : undefined;

  if (
    hasOwn("startTime") ||
    hasOwn("endTime") ||
    hasOwn("startTs") ||
    hasOwn("endTs")
  ) {
    try {
      if (startForDuration === undefined || endForDuration === undefined) {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const existing = snap.data();
          if (startForDuration === undefined) {
            startForDuration = existing?.startTs ?? existing?.startTime ?? null;
          }
          if (endForDuration === undefined) {
            endForDuration = existing?.endTs ?? existing?.endTime ?? null;
          }
        }
      }
    } catch (error) {
      logError(error, { where: "services.fs.updateTimeLog.fetch", id });
    }

    const computedDuration = computeDurationMinutes(
      startForDuration,
      endForDuration,
    );
    payload.duration = computedDuration;

    if (!hasOwn("status")) {
      const statusValue = endForDuration ? "closed" : "open";
      payload.status = statusValue;
    }
  }

  if (hasOwn("status")) {
    payload.status = data.status ?? null;
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
