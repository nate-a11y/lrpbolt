/* Proprietary and confidential. See LICENSE. */
import { createContext, useEffect, useMemo, useRef, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import { db } from "@/utils/firebaseInit.js";
import logError from "@/utils/logError.js";

/**
 * Detect an active time session even if schema varies:
 * - Collection: timeLogs (default)
 * - User field: userId | uid | driverId
 * - Start field: startTime | start | clockIn
 * - End field: endTime | end | clockOut (null or missing = open)
 *
 * Emits: { hasActive, docId, startTimeTs, debug }
 */
export const ActiveClockContext = createContext({
  hasActive: false,
  docId: null,
  startTimeTs: null,
  debug: null,
});

export default function ActiveClockProvider({ children }) {
  const [state, setState] = useState({ hasActive: false, docId: null, startTimeTs: null, debug: null });
  const [uid, setUid] = useState(null);
  const uidRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(
      getAuth(),
      (user) => {
        const nextUid = user?.uid || null;
        uidRef.current = nextUid;
        setUid((prev) => {
          if (prev === nextUid) return prev;
          return nextUid;
        });
        if (!nextUid) {
          setState({ hasActive: false, docId: null, startTimeTs: null, debug: { reason: "signed-out" } });
        }
      },
      (error) => {
        logError(error, { where: "ActiveClockProvider", action: "authState" });
      },
    );
    return () => {
      try {
        unsub();
      } catch (error) {
        logError(error, { where: "ActiveClockProvider", action: "authUnsub" });
      }
    };
  }, []);

  useEffect(() => {
    if (!uid) return undefined;

    const col = collection(db, "timeLogs");
    const queries = [
      query(col, where("userId", "==", uid), orderBy("startTime", "desc"), limit(10)),
      query(col, where("uid", "==", uid), orderBy("startTime", "desc"), limit(10)),
      query(col, where("driverId", "==", uid), orderBy("startTime", "desc"), limit(10)),
    ];

    const unsubs = queries.map((q, idx) =>
      onSnapshot(
        q,
        (snapshot) => {
          const candidates = [];
          snapshot.forEach((doc) => {
            try {
              const data = doc.data() || {};
              const startTs = data.startTime ?? data.start ?? data.clockIn ?? null;
              const endVal = data.endTime ?? data.end ?? data.clockOut;
              const hasEndField =
                Object.prototype.hasOwnProperty.call(data, "endTime") ||
                Object.prototype.hasOwnProperty.call(data, "end") ||
                Object.prototype.hasOwnProperty.call(data, "clockOut");
              const open = !hasEndField || endVal === null;

              candidates.push({
                id: doc.id,
                startTs,
                open,
                raw: { ...data },
                qIndex: idx,
              });
            } catch (error) {
              logError(error, { where: "ActiveClockProvider", action: "parseDoc", docId: doc?.id });
            }
          });

          const openOnes = candidates.filter((candidate) => candidate.open);
          const chosen =
            openOnes.sort((a, b) => {
              const aSeconds = a.startTs?.seconds ?? -1;
              const bSeconds = b.startTs?.seconds ?? -1;
              return bSeconds - aSeconds;
            })[0] || null;

          setState((prev) => {
            const next = chosen
              ? {
                  hasActive: true,
                  docId: chosen.id,
                  startTimeTs: chosen.startTs || null,
                  debug: { source: `q${idx}`, chosen },
                }
              : { hasActive: false, docId: null, startTimeTs: null, debug: { source: `q${idx}`, recentCount: candidates.length } };

            if (
              prev.hasActive === next.hasActive &&
              prev.docId === next.docId &&
              (prev.startTimeTs?.seconds || null) === (next.startTimeTs?.seconds || null) &&
              (prev.startTimeTs?.nanoseconds || null) === (next.startTimeTs?.nanoseconds || null)
            ) {
              return prev.debug?.source === next.debug?.source ? prev : { ...prev, debug: next.debug };
            }
            return next;
          });
        },
        (error) => {
          logError(error, { where: "ActiveClockProvider", action: "snapshotError", queryIndex: idx });
        },
      ),
    );

    return () => {
      unsubs.forEach((unsubscribe, idx) => {
        if (typeof unsubscribe !== "function") return;
        try {
          unsubscribe();
        } catch (error) {
          logError(error, { where: "ActiveClockProvider", action: "snapshotUnsub", queryIndex: idx });
        }
      });
    };
  }, [uid]);

  const value = useMemo(() => state, [state]);
  return <ActiveClockContext.Provider value={value}>{children}</ActiveClockContext.Provider>;
}
