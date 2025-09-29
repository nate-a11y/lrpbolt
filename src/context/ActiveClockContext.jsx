/* Proprietary and confidential. See LICENSE. */
import { createContext, useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import { db } from "@/utils/firebaseInit.js";
import logError from "@/utils/logError.js";

const initialState = {
  hasActive: false,
  docId: null,
  startTimeTs: null,
};

export const ActiveClockContext = createContext(initialState);

function isSameTimestamp(a, b) {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  return a.seconds === b.seconds && a.nanoseconds === b.nanoseconds;
}

export default function ActiveClockProvider({ children }) {
  const [uid, setUid] = useState(null);
  const [state, setState] = useState(initialState);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        const nextUid = user?.uid ?? null;
        setUid((prev) => {
          if (prev === nextUid) return prev;
          return nextUid;
        });
        if (!nextUid) {
          setState((prev) => (prev.hasActive ? initialState : prev));
        }
      },
      (error) => {
        logError(error, { where: "ActiveClockProvider", action: "authState" });
      },
    );

    return () => {
      try {
        unsubscribe();
      } catch (error) {
        logError(error, { where: "ActiveClockProvider", action: "unsubAuth" });
      }
    };
  }, []);

  useEffect(() => {
    if (!uid) {
      setState((prev) => (prev.hasActive ? initialState : prev));
      return undefined;
    }

    const recentQuery = query(
      collection(db, "timeLogs"),
      where("userId", "==", uid),
      orderBy("startTime", "desc"),
      limit(10),
    );

    const unsubscribe = onSnapshot(
      recentQuery,
      (snapshot) => {
        let chosen = null;
        snapshot.forEach((doc) => {
          if (chosen) return;
          try {
            const data = doc.data();
            const hasEndField = Object.prototype.hasOwnProperty.call(data, "endTime");
            const isOpen = !hasEndField || data.endTime === null;
            if (isOpen) {
              chosen = { id: doc.id, startTime: data.startTime ?? null };
            }
          } catch (error) {
            logError(error, {
              where: "ActiveClockProvider",
              action: "parseSnapshotDoc",
              docId: doc?.id,
            });
          }
        });

        setState((prev) => {
          const nextState = chosen
            ? {
                hasActive: true,
                docId: chosen.id,
                startTimeTs: chosen.startTime ?? null,
              }
            : initialState;

          if (
            prev.hasActive === nextState.hasActive &&
            prev.docId === nextState.docId &&
            isSameTimestamp(prev.startTimeTs, nextState.startTimeTs)
          ) {
            return prev;
          }
          return nextState;
        });

        if (!chosen) {
          console.info("[ActiveClockProvider] No active time log found for uid:", uid);
        }
      },
      (error) => {
        logError(error, { where: "ActiveClockProvider", action: "snapshotError" });
        setState(initialState);
      },
    );

    return () => {
      try {
        unsubscribe();
      } catch (error) {
        logError(error, { where: "ActiveClockProvider", action: "unsubSnapshot" });
      }
    };
  }, [uid]);

  return <ActiveClockContext.Provider value={state}>{children}</ActiveClockContext.Provider>;
}
