/* Proprietary and confidential. See LICENSE. */
import { createContext, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import { db } from "@/services/firebase";
import { TIMECLOCK_SCHEMA, pickField } from "@/config/timeclockSchema";
import logError from "@/utils/logError.js";

/**
 * Aggregated listener across multiple user field queries.
 * NOW UID-AWARE:
 *  - Tracks uid in state (uidState) so we re-subscribe whenever auth changes.
 *  - Cleans up old listeners when uid changes or on unmount.
 *  - Prevents flicker/clobber by aggregating results before updating state.
 */
export const ActiveClockContext = createContext({
  hasActive: false,
  docId: null,
  startTimeTs: null, // Firestore Timestamp | null
  debug: null,
});

export default function ActiveClockProvider({ children }) {
  const [uidState, setUidState] = useState(null);
  const [state, setState] = useState({
    hasActive: false,
    docId: null,
    startTimeTs: null,
    debug: null,
  });

  // Aggregation caches (reset every uid change)
  const resultsRef = useRef(Object.create(null)); // { [qIndex]: { ready: bool, rows: [] } }
  const totalQueriesRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const unsub = onAuthStateChanged(getAuth(), (u) => {
      setUidState(u?.uid || null); // <- triggers resubscription effect
      // When signed out, clear visible state immediately
      if (!u?.uid) {
        setState({
          hasActive: false,
          docId: null,
          startTimeTs: null,
          debug: { reason: "signed-out" },
        });
      }
    });
    return () => {
      mountedRef.current = false;
      try {
        unsub();
      } catch (e) {
        logError(e);
      }
    };
  }, []);

  useEffect(() => {
    // Clean & reset caches on every uid change
    resultsRef.current = Object.create(null);
    totalQueriesRef.current = 0;

    // If no uid, nothing to subscribe to
    if (!uidState) return undefined;

    const colRef = collection(db, TIMECLOCK_SCHEMA.collection);
    const userFields = TIMECLOCK_SCHEMA.userFields;
    totalQueriesRef.current = userFields.length;

    // recompute from union
    function recompute() {
      const buckets = resultsRef.current;
      const allRows = [];
      let readyCount = 0;

      for (let i = 0; i < totalQueriesRef.current; i += 1) {
        const b = buckets[i];
        if (b?.ready) readyCount += 1;
        if (b?.rows?.length) allRows.push(...b.rows);
      }
      const allReady = readyCount === totalQueriesRef.current;

      const openRows = allRows.filter((r) => r.open);
      if (!allReady && openRows.length === 0) {
        // don't flip to no-active until all listeners reported at least once
        return;
      }

      const chosen =
        openRows.slice().sort((a, b) => {
          const as = a.startTs?.seconds ?? -1;
          const bs = b.startTs?.seconds ?? -1;
          return bs - as;
        })[0] || null;

      if (!mountedRef.current) return;
      setState((prev) => {
        if (chosen) {
          const same =
            prev.hasActive === true &&
            prev.docId === chosen.id &&
            (prev.startTimeTs?.seconds || null) ===
              (chosen.startTs?.seconds || null) &&
            (prev.startTimeTs?.nanoseconds || null) ===
              (chosen.startTs?.nanoseconds || null);

          if (same) {
            // keep debug fresh
            if (
              prev.debug?.qIndex === chosen.qIndex &&
              prev.debug?.uid === uidState &&
              prev.debug?.allReady === allReady
            )
              return prev;
            return {
              ...prev,
              debug: {
                ...(prev.debug || {}),
                uid: uidState,
                unionCount: allRows.length,
                qIndex: chosen.qIndex,
                keys: chosen.keys,
                allReady,
              },
            };
          }

          return {
            hasActive: true,
            docId: chosen.id,
            startTimeTs: chosen.startTs || null,
            debug: {
              uid: uidState,
              unionCount: allRows.length,
              qIndex: chosen.qIndex,
              keys: chosen.keys,
              allReady,
            },
          };
        }

        // allReady && no open
        return {
          hasActive: false,
          docId: null,
          startTimeTs: null,
          debug: {
            uid: uidState,
            unionCount: allRows.length,
            reason: "no-open",
            allReady,
          },
        };
      });
    }

    // Install listeners for each candidate user field
    const unsubs = userFields.map((userKey, idx) => {
      const qRef = query(colRef, where(userKey, "==", uidState), limit(25));
      // init bucket
      resultsRef.current[idx] = { ready: false, rows: [] };

      return onSnapshot(
        qRef,
        (snap) => {
          const rows = [];
          snap.forEach((d) => {
            const data = d.data() || {};
            const startPick = pickField(data, TIMECLOCK_SCHEMA.startFields);
            const endPick = pickField(data, TIMECLOCK_SCHEMA.endFields);
            const activePick = pickField(data, TIMECLOCK_SCHEMA.activeFlags);
            const hasEndField = !!endPick.key;
            const isActiveTrue = activePick.key
              ? Boolean(activePick.value)
              : null;
            const open =
              isActiveTrue === true || !hasEndField || endPick.value === null;

            rows.push({
              id: d.id,
              startTs: startPick.value || null,
              open,
              qIndex: idx,
              keys: {
                startKey: startPick.key,
                endKey: endPick.key,
                activeKey: activePick.key,
              },
              _raw: data,
            });
          });

          // store & mark ready
          resultsRef.current[idx] = { ready: true, rows };
          // recompute from union
          recompute();
        },
        (err) => {
          logError(err, {
            source: "ActiveClockProvider.onSnapshot",
            qIndex: idx,
          });
          // mark as ready (empty) to avoid blocking forever
          resultsRef.current[idx] = { ready: true, rows: [] };
          recompute();
        },
      );
    });

    return () => {
      // cleanup when uid changes or unmounts
      unsubs.forEach((u) => {
        try {
          u();
        } catch (e) {
          logError(e, { source: "ActiveClockProvider.unsubscribe" });
        }
      });
      resultsRef.current = Object.create(null);
      totalQueriesRef.current = 0;
    };
  }, [uidState]); // <-- resubscribe whenever auth UID changes

  const value = useMemo(() => state, [state]);
  return (
    <ActiveClockContext.Provider value={value}>
      {children}
    </ActiveClockContext.Provider>
  );
}
