import { getAuth } from "firebase/auth";
import { Timestamp, serverTimestamp } from "firebase/firestore";

import logError from "@/utils/logError.js";

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

const COLLECTION_SEGMENTS = ["games", "hyperlane", "highscores"];

function coerceNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(/[^0-9.+-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === "object" && value !== null) {
    if (Object.prototype.hasOwnProperty.call(value, "value")) {
      return coerceNumber(value.value);
    }
    if (Object.prototype.hasOwnProperty.call(value, "score")) {
      return coerceNumber(value.score);
    }
  }

  return null;
}

function coerceTimestamp(raw) {
  if (!raw) return null;
  if (typeof raw.toDate === "function" && typeof raw.seconds === "number") {
    return raw;
  }
  if (raw instanceof Date) {
    return Timestamp.fromDate(raw);
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Timestamp.fromMillis(raw);
  }
  if (typeof raw === "string" && raw.trim()) {
    const date = new Date(raw.trim());
    if (!Number.isNaN(date.getTime())) {
      return Timestamp.fromDate(date);
    }
  }
  if (typeof raw === "object" && typeof raw.toDate === "function") {
    try {
      const date = raw.toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return Timestamp.fromDate(date);
      }
    } catch (error) {
      logError(error, {
        where: "services.games.coerceTimestamp",
        raw,
      });
    }
  }
  if (
    typeof raw === "object" &&
    raw !== null &&
    ("seconds" in raw || "nanoseconds" in raw)
  ) {
    const seconds = Number(raw.seconds ?? raw._seconds ?? 0);
    const nanos = Number(raw.nanoseconds ?? raw._nanoseconds ?? 0);
    if (!Number.isFinite(seconds) && !Number.isFinite(nanos)) {
      return null;
    }
    return new Timestamp(
      Number.isFinite(seconds) ? seconds : 0,
      Number.isFinite(nanos) ? nanos : 0,
    );
  }
  return null;
}

function normalizeHighscore(docSnap) {
  try {
    const data = typeof docSnap?.data === "function" ? docSnap.data() : null;
    const safeData = data && typeof data === "object" ? data : {};
    const score = coerceNumber(safeData.score ?? safeData.value ?? null);
    const createdAt = coerceTimestamp(safeData.createdAt ?? null);
    const displayName =
      typeof safeData.displayName === "string" && safeData.displayName.trim()
        ? safeData.displayName.trim()
        : null;
    const uid = typeof safeData.uid === "string" ? safeData.uid : null;

    return {
      id: docSnap?.id ?? null,
      score: score ?? null,
      createdAt,
      displayName,
      uid,
    };
  } catch (error) {
    logError(error, {
      where: "services.games.normalizeHighscore",
      docId: docSnap?.id,
    });
    return {
      id: docSnap?.id ?? null,
      score: null,
      createdAt: null,
      displayName: null,
      uid: null,
    };
  }
}

function getCollectionRef(db) {
  return collection(db, ...COLLECTION_SEGMENTS);
}

function toTimestamp(input) {
  if (!input) return null;
  if (input instanceof Timestamp) return input;
  if (typeof input === "object") {
    if (
      typeof input.seconds === "number" &&
      typeof input.nanoseconds === "number"
    ) {
      return new Timestamp(input.seconds, input.nanoseconds);
    }
    if (typeof input.toDate === "function") {
      try {
        const dateValue = input.toDate();
        if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
          return Timestamp.fromDate(dateValue);
        }
      } catch (error) {
        logError(error, {
          where: "services.games.toTimestamp",
          input,
        });
      }
    }
  }
  if (input instanceof Date) {
    return Timestamp.fromDate(input);
  }
  if (typeof input === "number" && Number.isFinite(input)) {
    return Timestamp.fromMillis(input);
  }
  if (typeof input === "string" && input.trim()) {
    const date = new Date(input.trim());
    if (!Number.isNaN(date.getTime())) {
      return Timestamp.fromDate(date);
    }
  }
  return null;
}

export async function saveHyperlaneScore(score) {
  const db = getDb();
  const auth = getAuth();
  const user = auth?.currentUser || null;

  try {
    const ref = getCollectionRef(db);
    await addDoc(ref, {
      score: Number.isFinite(Number(score)) ? Number(score) : 0,
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

function subscribeScores({
  topN = 10,
  onData,
  onError,
  constraints = [],
  postProcess,
}) {
  try {
    const db = getDb();
    const ref = getCollectionRef(db);
    const q = query(
      ref,
      ...constraints,
      orderBy("score", "desc"),
      orderBy("createdAt", "desc"),
      limit(topN),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        try {
          const rows = snapshot.docs.map((docSnap) =>
            normalizeHighscore(docSnap),
          );
          const processed =
            typeof postProcess === "function" ? postProcess(rows) : rows;
          if (typeof onData === "function") {
            onData(processed);
          }
        } catch (error) {
          logError(error, {
            where: "services.games.subscribeScores.onData",
            topN,
          });
          if (typeof onError === "function") {
            onError(error);
          }
        }
      },
      (error) => {
        logError(error, {
          where: "services.games.subscribeScores.listener",
          topN,
        });
        if (typeof onError === "function") {
          onError(error);
        }
      },
    );
  } catch (error) {
    logError(error, {
      where: "services.games.subscribeScores",
      topN,
    });
    if (typeof onError === "function") {
      onError(error);
    }
    return () => {};
  }
}

export function subscribeTopHyperlaneScores({
  onData,
  onError,
  topN = 10,
} = {}) {
  return subscribeScores({ topN, onData, onError });
}

export function subscribeWeeklyHyperlaneScores({
  onData,
  onError,
  topN = 10,
  startAt,
} = {}) {
  const startTimestamp = toTimestamp(startAt);
  if (!startTimestamp) {
    if (typeof onData === "function") onData([]);
    return () => {};
  }

  const fetchMultiplier = Math.max(topN * 4, 40);
  try {
    const db = getDb();
    const ref = getCollectionRef(db);
    const q = query(
      ref,
      where("createdAt", ">=", startTimestamp),
      orderBy("createdAt", "desc"),
      orderBy("score", "desc"),
      limit(fetchMultiplier),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        try {
          const rows = snapshot.docs.map((docSnap) =>
            normalizeHighscore(docSnap),
          );
          const sorted = rows
            .filter((row) => Number.isFinite(Number(row.score)))
            .sort((a, b) => {
              const diff = (Number(b.score) || 0) - (Number(a.score) || 0);
              if (diff !== 0) return diff;
              const aTime = a.createdAt?.seconds ?? 0;
              const bTime = b.createdAt?.seconds ?? 0;
              return bTime - aTime;
            });
          const sliced = sorted.slice(0, topN);
          if (typeof onData === "function") {
            onData(sliced);
          }
        } catch (error) {
          logError(error, {
            where: "services.games.subscribeWeeklyHyperlaneScores.onData",
            topN,
          });
          if (typeof onError === "function") {
            onError(error);
          }
        }
      },
      (error) => {
        logError(error, {
          where: "services.games.subscribeWeeklyHyperlaneScores.listener",
          topN,
        });
        if (typeof onError === "function") {
          onError(error);
        }
      },
    );
  } catch (error) {
    logError(error, {
      where: "services.games.subscribeWeeklyHyperlaneScores",
      topN,
    });
    if (typeof onError === "function") {
      onError(error);
    }
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
    if (typeof onData === "function") onData(null);
    return () => {};
  }
  const startTimestamp = toTimestamp(startAt);
  if (!startTimestamp) {
    if (typeof onData === "function") onData(null);
    return () => {};
  }

  const fetchLimit = 50;

  try {
    const db = getDb();
    const ref = getCollectionRef(db);
    const q = query(
      ref,
      where("uid", "==", uid),
      where("createdAt", ">=", startTimestamp),
      orderBy("createdAt", "desc"),
      orderBy("score", "desc"),
      limit(fetchLimit),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        try {
          const rows = snapshot.docs.map((docSnap) =>
            normalizeHighscore(docSnap),
          );
          let best = null;
          for (const row of rows) {
            if (!Number.isFinite(Number(row.score))) continue;
            if (!best || Number(row.score) > Number(best.score)) {
              best = row;
            }
          }
          if (typeof onData === "function") {
            onData(best);
          }
        } catch (error) {
          logError(error, {
            where: "services.games.subscribeUserWeeklyHyperlaneBest.onData",
            uid,
          });
          if (typeof onError === "function") {
            onError(error);
          }
        }
      },
      (error) => {
        logError(error, {
          where: "services.games.subscribeUserWeeklyHyperlaneBest.listener",
          uid,
        });
        if (typeof onError === "function") {
          onError(error);
        }
      },
    );
  } catch (error) {
    logError(error, {
      where: "services.games.subscribeUserWeeklyHyperlaneBest",
      uid,
    });
    if (typeof onError === "function") {
      onError(error);
    }
    return () => {};
  }
}
