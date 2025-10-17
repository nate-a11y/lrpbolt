import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import logError from "@/utils/logError.js";
import { db } from "@/utils/firebaseInit.js";

/** Null-safe numeric coercion */
export function toNumberOrNull(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function resolveAppVersion() {
  if (typeof globalThis !== "undefined") {
    const tag = globalThis.__APP_VERSION__;
    if (typeof tag === "string" && tag) return tag;
  }
  return null;
}

/** Map highscore doc -> grid row */
export function mapHighscoreDoc(snap) {
  const data = typeof snap?.data === "function" ? snap.data() : {};
  const rawDriver =
    typeof data?.displayName === "string" && data.displayName.trim()
      ? data.displayName.trim()
      : "Unknown";

  const createdAtValue = data?.createdAt;
  const hasTimestamp =
    createdAtValue && typeof createdAtValue.toDate === "function";

  return {
    id: snap?.id ?? null,
    uid: typeof data?.uid === "string" && data.uid ? data.uid : null,
    driver: rawDriver,
    displayName: rawDriver,
    score: toNumberOrNull(data?.score),
    createdAt: hasTimestamp ? createdAtValue : null,
    version: data?.version || null,
    ua: data?.ua || null,
  };
}

/** Subscribe to top N scores for a game (descending) */
export function subscribeTopScores(game, topN, cb, onError) {
  if (!game) throw new Error("game is required");
  if (typeof cb !== "function") throw new Error("callback is required");

  const col = collection(db, "games", game, "highscores");
  const q = query(
    col,
    where("score", ">=", 0),
    orderBy("score", "desc"),
    limit(topN || 10),
  );

  return onSnapshot(
    q,
    (qs) => {
      try {
        const rows = qs.docs
          .map(mapHighscoreDoc)
          .filter((row) => Number.isFinite(row?.score) && row.score >= 0)
          .filter(
            (row) =>
              row?.createdAt && typeof row.createdAt.toDate === "function",
          );
        cb(rows);
      } catch (error) {
        logError(error, { where: "gamesService.subscribeTopScores.map" });
        onError?.(error);
      }
    },
    (error) => {
      logError(error, { where: "gamesService.subscribeTopScores" });
      onError?.(error);
    },
  );
}

/** Submit a highscore; requires auth upstream */
export async function submitHighscore({
  game,
  uid,
  displayName,
  score,
  version,
}) {
  if (!game) throw new Error("game is required");
  const numericScore = toNumberOrNull(score);
  if (numericScore === null) throw new Error("score must be a number");

  const inferredVersion =
    typeof version === "string" && version ? version : resolveAppVersion();

  const col = collection(db, "games", game, "highscores");
  const payload = {
    uid: uid || "anon",
    displayName: displayName || "Anonymous",
    score: numericScore,
    createdAt: serverTimestamp(),
    version: inferredVersion,
    ua:
      typeof navigator !== "undefined" && navigator?.userAgent
        ? navigator.userAgent
        : null,
  };

  try {
    return await addDoc(col, payload);
  } catch (error) {
    logError(error, { where: "gamesService.submitHighscore", game, uid });
    throw error;
  }
}
