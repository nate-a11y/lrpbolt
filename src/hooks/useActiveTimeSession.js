/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/utils/firebaseInit.js";
import logError from "@/utils/logError.js";

const COLLECTION_NAME = "timeLogs";

export default function useActiveTimeSession(userId) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(userId));

  const q = useMemo(() => {
    if (!userId) return null;
    try {
      const colRef = collection(db, COLLECTION_NAME);
      return query(
        colRef,
        where("userId", "==", userId),
        where("endTime", "==", null),
        orderBy("startTime", "desc"),
        limit(1),
      );
    } catch (error) {
      logError(error, {
        where: "useActiveTimeSession",
        action: "build-query",
      });
      return null;
    }
  }, [userId]);

  useEffect(() => {
    if (!q) {
      setSession(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const unsub = onSnapshot(
      q,
      (snap) => {
        const doc = snap.docs?.[0] || null;
        setSession(doc ? { id: doc.id, ...doc.data() } : null);
        setLoading(false);
      },
      (error) => {
        logError(error, {
          where: "useActiveTimeSession",
          action: "snapshot",
        });
        setSession(null);
        setLoading(false);
      },
    );

    return () => {
      try {
        unsub();
      } catch (error) {
        logError(error, {
          where: "useActiveTimeSession",
          action: "cleanup",
        });
      }
    };
  }, [q]);

  return { session, loading };
}
