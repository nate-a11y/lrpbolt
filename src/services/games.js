import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

import logError from "@/utils/logError.js";

import { getDb } from "./firestoreCore";

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
  if (typeof raw.toDate === "function") return raw;
  if (raw instanceof Date) return raw;

  if (typeof raw === "object") {
    const seconds = raw.seconds ?? raw._seconds;
    const nanos = raw.nanoseconds ?? raw._nanoseconds;
    const hasSeconds = Number.isFinite(Number(seconds));
    const hasNanos = Number.isFinite(Number(nanos));

    if (!hasSeconds && !hasNanos) {
      return null;
    }

    return {
      seconds: hasSeconds ? Number(seconds) : 0,
      nanoseconds: hasNanos ? Number(nanos) : 0,
      toDate() {
        const ms = this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
        return new Date(ms);
      },
    };
  }

  return null;
}

function coerceDisplayName(value) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function normalizeHighscore(docSnap) {
  const data = docSnap?.data?.();
  const rawData = typeof data === "object" && data !== null ? data : {};

  const rawScore = rawData.score ?? rawData.value ?? rawData.data?.score;
  const score = coerceNumber(rawScore);

  const createdAtSource = rawData.createdAt ?? rawData.data?.createdAt ?? null;
  let createdAt = coerceTimestamp(createdAtSource);
  if (
    !createdAt &&
    typeof createdAtSource === "number" &&
    Number.isFinite(createdAtSource)
  ) {
    const millis = Number(createdAtSource);
    createdAt = {
      seconds: Math.floor(millis / 1000),
      nanoseconds: 0,
      toDate() {
        return new Date(millis);
      },
    };
  }
  if (
    !createdAt &&
    typeof createdAtSource === "string" &&
    createdAtSource.trim().length > 0
  ) {
    createdAt = createdAtSource.trim();
  }

  const displayName =
    coerceDisplayName(rawData.displayName) ??
    coerceDisplayName(rawData.data?.displayName) ??
    coerceDisplayName(rawData.name) ??
    coerceDisplayName(rawData.handle);

  const uid = typeof rawData.uid === "string" ? rawData.uid : null;

  return {
    id: docSnap.id,
    score: score ?? null,
    displayName: displayName ?? null,
    uid,
    createdAt,
  };
}

export async function saveDriftBossScore(score) {
  try {
    const db = getDb();
    const auth = getAuth();
    const user = auth?.currentUser || null;

    const ref = collection(db, "games", "driftboss", "highscores");
    await addDoc(ref, {
      score: Number.isFinite(Number(score)) ? Number(score) : 0,
      uid: user?.uid || null,
      displayName: user?.displayName || null,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    logError(err, { where: "services.games.saveDriftBossScore", score });
    throw err;
  }
}

export function subscribeTopDriftBossScores({
  onData,
  onError,
  topN = 10,
} = {}) {
  try {
    const db = getDb();
    const ref = collection(db, "games", "driftboss", "highscores");
    const q = query(
      ref,
      orderBy("score", "desc"),
      orderBy("createdAt", "desc"),
      limit(topN),
    );
    return onSnapshot(
      q,
      (snapshot) => {
        try {
          const rows = [];
          snapshot.forEach((docSnap) => {
            rows.push(normalizeHighscore(docSnap));
          });
          if (typeof onData === "function") {
            onData(rows);
          }
        } catch (err) {
          logError(err, {
            where: "services.games.subscribeTopDriftBossScores.data",
            topN,
          });
          if (typeof onError === "function") {
            onError(err);
          }
        }
      },
      (err) => {
        logError(err, {
          where: "services.games.subscribeTopDriftBossScores.listener",
          topN,
        });
        if (typeof onError === "function") {
          onError(err);
        }
      },
    );
  } catch (err) {
    logError(err, {
      where: "services.games.subscribeTopDriftBossScores",
      topN,
    });
    if (typeof onError === "function") {
      onError(err);
    }
    return () => {};
  }
}
