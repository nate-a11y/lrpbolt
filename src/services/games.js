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
            rows.push({ id: docSnap.id, ...docSnap.data() });
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
