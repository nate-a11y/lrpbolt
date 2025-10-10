import { getAuth } from "firebase/auth";
import { serverTimestamp } from "firebase/firestore";

import logError from "@/utils/logError.js";
import { startOfWeekLocal } from "@/utils/time.js";

import {
  addDoc,
  collection,
  getDb,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "./firestoreCore";

const COLLECTION_SEGMENTS = ["games", "hyperloop", "sessions"];
const WEEKLY_BUFFER_SIZE = 200;

function getCollectionRef(db) {
  return collection(db, ...COLLECTION_SEGMENTS);
}

function parseDuration(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return numeric;
}

function sanitizeDisplayName(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return "Anonymous";
}

function mapSession(docSnap) {
  try {
    const data = typeof docSnap?.data === "function" ? docSnap.data() : {};
    const durationMs = parseDuration(data?.durationMs);
    const createdAt =
      data?.createdAt && typeof data.createdAt.toDate === "function"
        ? data.createdAt
        : null;

    return {
      id: docSnap?.id ?? "",
      driver: sanitizeDisplayName(data?.displayName),
      durationMs,
      createdAt,
      uid: typeof data?.uid === "string" ? data.uid : null,
    };
  } catch (error) {
    logError(error, {
      where: "services.gamesHyperloop.mapSession",
      docId: docSnap?.id,
    });
    return {
      id: docSnap?.id ?? "",
      driver: "Anonymous",
      durationMs: 0,
      createdAt: null,
      uid: null,
    };
  }
}

export async function saveHyperloopSession(durationMs) {
  const db = getDb();
  const auth = getAuth();
  const user = auth?.currentUser || null;
  const safeDuration = parseDuration(durationMs);

  try {
    const ref = getCollectionRef(db);
    await addDoc(ref, {
      durationMs: safeDuration,
      uid: user?.uid || null,
      displayName: user?.displayName || null,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    logError(error, {
      where: "services.gamesHyperloop.saveHyperloopSession",
      uid: user?.uid || null,
    });
    throw error;
  }
}

function handleSnapshot({ snapshot, onData, onError, transform }) {
  try {
    const rows = snapshot.docs.map((docSnap) => mapSession(docSnap));
    const processed = typeof transform === "function" ? transform(rows) : rows;
    onData?.(processed);
  } catch (error) {
    logError(error, { where: "services.gamesHyperloop.handleSnapshot" });
    onError?.(error);
  }
}

export function subscribeTopHyperloopAllTime({
  topN = 10,
  onData,
  onError,
} = {}) {
  try {
    const db = getDb();
    const ref = getCollectionRef(db);
    const q = query(
      ref,
      orderBy("durationMs", "desc"),
      orderBy("createdAt", "desc"),
      limit(topN),
    );

    return onSnapshot(
      q,
      (snapshot) => handleSnapshot({ snapshot, onData, onError }),
      (error) => {
        logError(error, {
          where:
            "services.gamesHyperloop.subscribeTopHyperloopAllTime.listener",
          topN,
        });
        onError?.(error);
      },
    );
  } catch (error) {
    logError(error, {
      where: "services.gamesHyperloop.subscribeTopHyperloopAllTime",
      topN,
    });
    onError?.(error);
    return () => {};
  }
}

export function subscribeTopHyperloopWeekly({
  topN = 10,
  onData,
  onError,
} = {}) {
  try {
    const db = getDb();
    const ref = getCollectionRef(db);
    const fetchLimit = Math.max(topN * 4, WEEKLY_BUFFER_SIZE);
    const q = query(ref, orderBy("createdAt", "desc"), limit(fetchLimit));

    return onSnapshot(
      q,
      (snapshot) => {
        const weekStartDate = startOfWeekLocal()?.toDate?.() ?? new Date(0);
        handleSnapshot({
          snapshot,
          onData,
          onError,
          transform: (rows) => {
            const filtered = rows.filter((row) => {
              const created = row?.createdAt;
              const dateValue =
                created && typeof created.toDate === "function"
                  ? created.toDate()
                  : null;
              return dateValue ? dateValue >= weekStartDate : false;
            });
            filtered.sort((a, b) => {
              const diff = (b.durationMs ?? 0) - (a.durationMs ?? 0);
              if (diff !== 0) return diff;
              const aSeconds = a?.createdAt?.seconds ?? 0;
              const bSeconds = b?.createdAt?.seconds ?? 0;
              return bSeconds - aSeconds;
            });
            return filtered.slice(0, topN);
          },
        });
      },
      (error) => {
        logError(error, {
          where: "services.gamesHyperloop.subscribeTopHyperloopWeekly.listener",
          topN,
        });
        onError?.(error);
      },
    );
  } catch (error) {
    logError(error, {
      where: "services.gamesHyperloop.subscribeTopHyperloopWeekly",
      topN,
    });
    onError?.(error);
    return () => {};
  }
}

export function subscribeTopHyperloopSessions(options) {
  return subscribeTopHyperloopAllTime(options);
}
