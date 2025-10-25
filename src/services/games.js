import { getAuth } from "firebase/auth";
import { serverTimestamp, Timestamp } from "firebase/firestore";

import logError from "@/utils/logError.js";
import { startOfWeekLocal } from "@/utils/time.js";

import { toNumberOrNull } from "./gamesService.js";
import {
  addDoc,
  collection,
  getDb,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "./firestoreCore";

const HYPERLANE_COLLECTION_SEGMENTS = ["games", "hyperlane", "highscores"];
const LAKECROSSING_COLLECTION_SEGMENTS = [
  "games",
  "lakecrossing",
  "highscores",
];
const WEEKLY_BUFFER_SIZE = 200;

function getHyperlaneCollectionRef(db) {
  return collection(db, ...HYPERLANE_COLLECTION_SEGMENTS);
}

function getLakeCrossingCollectionRef(db) {
  return collection(db, ...LAKECROSSING_COLLECTION_SEGMENTS);
}

function parseScore(value) {
  return toNumberOrNull(value);
}

function parseDisplayName(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return "Anonymous";
}

function parseTimestamp(raw) {
  if (!raw) return null;
  if (raw instanceof Timestamp) return raw;
  if (typeof raw.toDate === "function") {
    try {
      const dateValue = raw.toDate();
      return Timestamp.fromDate(dateValue);
    } catch (error) {
      logError(error, { where: "services.games.parseTimestamp.toDate" });
      return null;
    }
  }
  if (raw instanceof Date) {
    return Timestamp.fromDate(raw);
  }
  if (typeof raw === "object" && ("seconds" in raw || "nanoseconds" in raw)) {
    const seconds = Number(raw.seconds ?? 0);
    const nanos = Number(raw.nanoseconds ?? 0);
    if (!Number.isFinite(seconds) && !Number.isFinite(nanos)) return null;
    return new Timestamp(
      Number.isFinite(seconds) ? seconds : 0,
      Number.isFinite(nanos) ? nanos : 0,
    );
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Timestamp.fromMillis(raw);
  }
  if (typeof raw === "string") {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return Timestamp.fromDate(parsed);
    }
  }
  return null;
}

function mapHighscore(docSnap) {
  try {
    const data = typeof docSnap?.data === "function" ? docSnap.data() : {};
    const score = parseScore(data?.score);
    const createdAt =
      data?.createdAt && typeof data.createdAt.toDate === "function"
        ? data.createdAt
        : null;

    const driverName = parseDisplayName(data?.displayName);

    return {
      id: docSnap?.id ?? "",
      driver: driverName,
      displayName: driverName,
      score,
      createdAt,
      uid: typeof data?.uid === "string" ? data.uid : null,
    };
  } catch (error) {
    logError(error, {
      where: "services.games.mapHighscore",
      docId: docSnap?.id,
    });
    return {
      id: docSnap?.id ?? "",
      driver: "Anonymous",
      score: null,
      createdAt: null,
      uid: null,
    };
  }
}

export async function saveHyperlaneScore(score) {
  const db = getDb();
  const auth = getAuth();
  const user = auth?.currentUser || null;
  const numericScore = parseScore(score) ?? 0;

  try {
    const ref = getHyperlaneCollectionRef(db);
    await addDoc(ref, {
      score: numericScore,
      uid: user?.uid || null,
      displayName: user?.displayName || null,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    logError(error, {
      where: "services.games.saveHyperlaneScore",
      score,
      uid: user?.uid || null,
    });
    throw error;
  }
}

function handleSnapshot({ snapshot, onData, onError, transform }) {
  try {
    const rows = snapshot.docs
      .map((docSnap) => mapHighscore(docSnap))
      .filter((row) => Number.isFinite(row?.score) && row.score >= 0)
      .filter(
        (row) => row?.createdAt && typeof row.createdAt.toDate === "function",
      );
    const processed = typeof transform === "function" ? transform(rows) : rows;
    onData?.(processed);
  } catch (error) {
    logError(error, { where: "services.games.handleSnapshot" });
    onError?.(error);
  }
}

export function subscribeTopHyperlaneAllTime({
  topN = 10,
  onData,
  onError,
} = {}) {
  try {
    const db = getDb();
    const ref = getHyperlaneCollectionRef(db);
    const q = query(
      ref,
      where("score", ">=", 0),
      orderBy("score", "desc"),
      orderBy("createdAt", "desc"),
      limit(topN),
    );

    return onSnapshot(
      q,
      (snapshot) => handleSnapshot({ snapshot, onData, onError }),
      (error) => {
        logError(error, {
          where: "services.games.subscribeTopHyperlaneAllTime.listener",
          topN,
        });
        onError?.(error);
      },
    );
  } catch (error) {
    logError(error, {
      where: "services.games.subscribeTopHyperlaneAllTime",
      topN,
    });
    onError?.(error);
    return () => {};
  }
}

export function subscribeTopHyperlaneWeekly({
  topN = 10,
  onData,
  onError,
} = {}) {
  try {
    const db = getDb();
    const ref = getHyperlaneCollectionRef(db);
    const fetchLimit = Math.max(topN * 4, WEEKLY_BUFFER_SIZE);
    const q = query(ref, orderBy("createdAt", "desc"), limit(fetchLimit));

    return onSnapshot(
      q,
      (snapshot) => {
        const weekStartDate = startOfWeekLocal()?.toDate?.() ?? new Date(0);
        handleSnapshot({
          snapshot,
          onError,
          onData,
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
              const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
              if (scoreDiff !== 0) return scoreDiff;
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
          where: "services.games.subscribeTopHyperlaneWeekly.listener",
          topN,
        });
        onError?.(error);
      },
    );
  } catch (error) {
    logError(error, {
      where: "services.games.subscribeTopHyperlaneWeekly",
      topN,
    });
    onError?.(error);
    return () => {};
  }
}

export function subscribeUserWeeklyHyperlaneBest({
  uid,
  startAt,
  onData,
  onError,
} = {}) {
  if (!uid) {
    onData?.(null);
    return () => {};
  }
  const startTimestamp = parseTimestamp(startAt);
  if (!startTimestamp) {
    onData?.(null);
    return () => {};
  }

  try {
    const db = getDb();
    const ref = getHyperlaneCollectionRef(db);
    const q = query(
      ref,
      where("uid", "==", uid),
      where("createdAt", ">=", startTimestamp),
      orderBy("createdAt", "desc"),
      orderBy("score", "desc"),
      limit(50),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        try {
          const rows = snapshot.docs.map((docSnap) => mapHighscore(docSnap));
          let best = null;
          for (const row of rows) {
            if (!Number.isFinite(row?.score)) continue;
            if (!best || (row?.score ?? 0) > (best?.score ?? 0)) {
              best = row;
            }
          }
          onData?.(best);
        } catch (error) {
          logError(error, {
            where: "services.games.subscribeUserWeeklyHyperlaneBest.onData",
            uid,
          });
          onError?.(error);
        }
      },
      (error) => {
        logError(error, {
          where: "services.games.subscribeUserWeeklyHyperlaneBest.listener",
          uid,
        });
        onError?.(error);
      },
    );
  } catch (error) {
    logError(error, {
      where: "services.games.subscribeUserWeeklyHyperlaneBest",
      uid,
    });
    onError?.(error);
    return () => {};
  }
}

// ===== Lake Crossing Functions =====

export async function saveLakeCrossingScore(score) {
  const db = getDb();
  const auth = getAuth();
  const user = auth?.currentUser || null;
  const numericScore = parseScore(score) ?? 0;

  try {
    const ref = getLakeCrossingCollectionRef(db);
    await addDoc(ref, {
      score: numericScore,
      uid: user?.uid || null,
      displayName: user?.displayName || null,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    logError(error, {
      where: "services.games.saveLakeCrossingScore",
      score,
      uid: user?.uid || null,
    });
    throw error;
  }
}

export function subscribeTopLakeCrossingAllTime({
  topN = 10,
  onData,
  onError,
} = {}) {
  try {
    const db = getDb();
    const ref = getLakeCrossingCollectionRef(db);
    const q = query(
      ref,
      where("score", ">=", 0),
      orderBy("score", "desc"),
      orderBy("createdAt", "desc"),
      limit(topN),
    );

    return onSnapshot(
      q,
      (snapshot) => handleSnapshot({ snapshot, onData, onError }),
      (error) => {
        logError(error, {
          where: "services.games.subscribeTopLakeCrossingAllTime.listener",
          topN,
        });
        onError?.(error);
      },
    );
  } catch (error) {
    logError(error, {
      where: "services.games.subscribeTopLakeCrossingAllTime",
      topN,
    });
    onError?.(error);
    return () => {};
  }
}

export function subscribeTopLakeCrossingWeekly({
  topN = 10,
  onData,
  onError,
} = {}) {
  try {
    const db = getDb();
    const ref = getLakeCrossingCollectionRef(db);
    const fetchLimit = Math.max(topN * 4, WEEKLY_BUFFER_SIZE);
    const q = query(ref, orderBy("createdAt", "desc"), limit(fetchLimit));

    return onSnapshot(
      q,
      (snapshot) => {
        const weekStartDate = startOfWeekLocal()?.toDate?.() ?? new Date(0);
        handleSnapshot({
          snapshot,
          onError,
          onData,
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
              const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
              if (scoreDiff !== 0) return scoreDiff;
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
          where: "services.games.subscribeTopLakeCrossingWeekly.listener",
          topN,
        });
        onError?.(error);
      },
    );
  } catch (error) {
    logError(error, {
      where: "services.games.subscribeTopLakeCrossingWeekly",
      topN,
    });
    onError?.(error);
    return () => {};
  }
}

export function subscribeUserWeeklyLakeCrossingBest({
  uid,
  startAt,
  onData,
  onError,
} = {}) {
  if (!uid) {
    onData?.(null);
    return () => {};
  }
  const startTimestamp = parseTimestamp(startAt);
  if (!startTimestamp) {
    onData?.(null);
    return () => {};
  }

  try {
    const db = getDb();
    const ref = getLakeCrossingCollectionRef(db);
    const q = query(
      ref,
      where("uid", "==", uid),
      where("createdAt", ">=", startTimestamp),
      orderBy("createdAt", "desc"),
      orderBy("score", "desc"),
      limit(50),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        try {
          const rows = snapshot.docs.map((docSnap) => mapHighscore(docSnap));
          let best = null;
          for (const row of rows) {
            if (!Number.isFinite(row?.score)) continue;
            if (!best || (row?.score ?? 0) > (best?.score ?? 0)) {
              best = row;
            }
          }
          onData?.(best);
        } catch (error) {
          logError(error, {
            where: "services.games.subscribeUserWeeklyLakeCrossingBest.onData",
            uid,
          });
          onError?.(error);
        }
      },
      (error) => {
        logError(error, {
          where: "services.games.subscribeUserWeeklyLakeCrossingBest.listener",
          uid,
        });
        onError?.(error);
      },
    );
  } catch (error) {
    logError(error, {
      where: "services.games.subscribeUserWeeklyLakeCrossingBest",
      uid,
    });
    onError?.(error);
    return () => {};
  }
}
