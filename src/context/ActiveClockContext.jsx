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

/**
 * Aggregates results from multiple onSnapshot listeners (userId/uid/driverId).
 * - Stores each listener's rows in a ref.
 * - Recomputes a single "chosen" open session from the union.
 * - BEFORE all listeners have reported at least once, we NEVER flip to no-active.
 *   (prevents flicker/clobber when non-matching queries return empty)
 * - AFTER all are ready, we can flip to no-active if none are open.
 */
export const ActiveClockContext = createContext({
  hasActive: false,
  docId: null,
  startTimeTs: null,
  debug: null,
});

export default function ActiveClockProvider({ children }) {
  const [state, setState] = useState({
    hasActive: false,
    docId: null,
    startTimeTs: null,
    debug: null,
  });
  const uidRef = useRef(null);

  // per-listener cache: { [qIndex]: { ready: bool, rows: Array } }
  const resultsRef = useRef(Object.create(null));
  const totalQueriesRef = useRef(0);

  // auth
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (u) => {
      uidRef.current = u?.uid || null;
      // reset caches on sign-out
      resultsRef.current = Object.create(null);
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
      try {
        unsub();
      } catch (e) {
        console.error(e);
      }
    };
  }, []);

  useEffect(() => {
    const uid = uidRef.current;
    if (!uid) return undefined;

    const colRef = collection(db, TIMECLOCK_SCHEMA.collection);
    const userFields = TIMECLOCK_SCHEMA.userFields;
    totalQueriesRef.current = userFields.length;

    // helper to compute chosen from union (rowsByQuery = { idx: rows[] })
    function recompute() {
      const allRows = [];
      let readySeen = 0;

      for (let i = 0; i < totalQueriesRef.current; i += 1) {
        const bucket = resultsRef.current[i];
        if (bucket?.ready) readySeen += 1;
        if (bucket?.rows?.length) allRows.push(...bucket.rows);
      }

      const allReady = readySeen === totalQueriesRef.current;

      // Find open rows
      const openRows = allRows.filter((r) => r.open);

      // If not all listeners have reported yet:
      //  - If we already have active, keep it unless a *better* open replaces it.
      //  - If we don't have active yet and current union has no open, DO NOT set no-active yet.
      if (!allReady && openRows.length === 0) {
        // keep current state (prevents clobber flicker)
        return;
      }

      // Choose best open by latest start timestamp
      const chosen =
        openRows.slice().sort((a, b) => {
          const as = a.startTs?.seconds ?? -1;
          const bs = b.startTs?.seconds ?? -1;
          return bs - as;
        })[0] || null;

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
            // still update debug with latest provenance
            if (prev.debug?.qIndex === chosen.qIndex) return prev;
            return {
              ...prev,
              debug: {
                ...(prev.debug || {}),
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
              unionCount: allRows.length,
              qIndex: chosen.qIndex,
              keys: chosen.keys,
              allReady,
            },
          };
        }

        // Only here if allReady and no open rows
        if (!prev.hasActive) {
          // keep debug fresh
          return {
            ...prev,
            debug: { unionCount: allRows.length, reason: "no-open", allReady },
          };
        }
        return {
          hasActive: false,
          docId: null,
          startTimeTs: null,
          debug: { unionCount: allRows.length, reason: "no-open", allReady },
        };
      });
    }

    // install listeners
    const unsubs = userFields.map((userKey, idx) => {
      const q = query(colRef, where(userKey, "==", uid), limit(25));
      // initialize slot
      resultsRef.current[idx] = { ready: false, rows: [] };

      return onSnapshot(
        q,
        (snap) => {
          const rows = [];
          snap.forEach((d) => {
            const data = d.data() || {};
            const startPick = pickField(data, TIMECLOCK_SCHEMA.startFields);
            const endPick = pickField(data, TIMECLOCK_SCHEMA.endFields);
            const activePick = pickField(data, TIMECLOCK_SCHEMA.activeFlags);
            const hasEndField = !!endPick.key;
            const isActiveFlagTrue = activePick.key
              ? Boolean(activePick.value)
              : null;
            const open =
              isActiveFlagTrue === true ||
              !hasEndField ||
              endPick.value === null;

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

          resultsRef.current[idx] = { ready: true, rows };

          // Recompute from union; do NOT write hasActive:false based on a single empty snap
          recompute();
        },
        (err) => {
          console.error("[ActiveClockProvider] snapshot error", err);
          // mark as ready to avoid blocking forever
          resultsRef.current[idx] = { ready: true, rows: [] };
          recompute();
        },
      );
    });

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch (e) {
          console.error(e);
        }
      });
      // reset caches on unmount
      resultsRef.current = Object.create(null);
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return (
    <ActiveClockContext.Provider value={value}>
      {children}
    </ActiveClockContext.Provider>
  );
}
