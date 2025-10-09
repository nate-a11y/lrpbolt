import { getAuth } from "firebase/auth";
import { serverTimestamp } from "firebase/firestore";

import logError from "@/utils/logError.js";

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

function getCollectionRef(db) {
  return collection(db, ...COLLECTION_SEGMENTS);
}

function normalizeSession(docSnap) {
  try {
    const data = typeof docSnap?.data === "function" ? docSnap.data() : {};
    const rawDuration = data?.durationMs;
    const durationMs = Number(rawDuration);
    return {
      id: docSnap?.id ?? null,
      durationMs:
        Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0,
      displayName:
        typeof data?.displayName === "string" && data.displayName.trim()
          ? data.displayName.trim()
          : null,
      uid: typeof data?.uid === "string" ? data.uid : null,
      createdAt:
        data?.createdAt && typeof data.createdAt.toDate === "function"
          ? data.createdAt
          : null,
    };
  } catch (error) {
    logError(error, {
      where: "services.gamesHyperloop.normalizeSession",
      docId: docSnap?.id,
    });
    return {
      id: docSnap?.id ?? null,
      durationMs: 0,
      displayName: null,
      uid: null,
      createdAt: null,
    };
  }
}

export async function saveHyperloopSession(durationMs) {
  const db = getDb();
  const auth = getAuth();
  const user = auth?.currentUser || null;
  const safeDuration = Number(durationMs);
  const payload = {
    durationMs:
      Number.isFinite(safeDuration) && safeDuration >= 0 ? safeDuration : 0,
    uid: user?.uid || null,
    displayName: user?.displayName || null,
    createdAt: serverTimestamp(),
  };

  try {
    const ref = getCollectionRef(db);
    await addDoc(ref, payload);
  } catch (error) {
    logError(error, {
      where: "services.gamesHyperloop.saveHyperloopSession",
      uid: user?.uid || null,
    });
    throw error;
  }
}

export function subscribeTopHyperloopSessions({
  onData,
  onError,
  topN = 10,
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
      (snapshot) => {
        try {
          const rows = snapshot.docs.map((docSnap) =>
            normalizeSession(docSnap),
          );
          if (typeof onData === "function") {
            onData(rows);
          }
        } catch (error) {
          logError(error, {
            where: "services.gamesHyperloop.subscribeTopSessions.onData",
            topN,
          });
          if (typeof onError === "function") {
            onError(error);
          }
        }
      },
      (error) => {
        logError(error, {
          where: "services.gamesHyperloop.subscribeTopSessions.listener",
          topN,
        });
        if (typeof onError === "function") {
          onError(error);
        }
      },
    );
  } catch (error) {
    logError(error, {
      where: "services.gamesHyperloop.subscribeTopSessions",
      topN,
    });
    if (typeof onError === "function") {
      onError(error);
    }
    return () => {};
  }
}
