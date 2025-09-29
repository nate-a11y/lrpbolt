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
 * Detects an active time session across varied schemas.
 * Emits: { hasActive, docId, startTimeTs, debug }
 * - Queries each possible user field in parallel.
 * - No orderBy requirement (avoids missing-index errors).
 * - Open = explicit boolean active flag OR (no end field) OR (end field === null).
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
  const lastChosenRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (u) => {
      uidRef.current = u?.uid || null;
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
    const unsubs = TIMECLOCK_SCHEMA.userFields.map((userKey, idx) => {
      const q = query(colRef, where(userKey, "==", uid), limit(25));
      return onSnapshot(
        q,
        (snap) => {
          const rows = [];
          snap.forEach((d) => {
            const data = d.data() || {};
            const start = pickField(data, TIMECLOCK_SCHEMA.startFields).value;
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
              startTs: start || null,
              open,
              keys: {
                startKey: pickField(data, TIMECLOCK_SCHEMA.startFields).key,
                endKey: endPick.key,
                activeKey: activePick.key,
              },
              qIndex: idx,
              _raw: data,
            });
          });

          // prefer rows with a start timestamp; then fallback to any "open"
          const openRows = rows.filter((r) => r.open);
          const sorted = openRows.sort((a, b) => {
            const as = a.startTs?.seconds ?? -1;
            const bs = b.startTs?.seconds ?? -1;
            return bs - as;
          });
          const chosen = sorted[0] || null;

          setState((prev) => {
            // de-dupe: only update when the chosen doc actually changes
            const prevId = prev.docId || null;
            const nextId = chosen?.id || null;
            const sameStart =
              (prev.startTimeTs?.seconds || null) ===
                (chosen?.startTs?.seconds || null) &&
              (prev.startTimeTs?.nanoseconds || null) ===
                (chosen?.startTs?.nanoseconds || null);

            if (prev.hasActive === !!chosen && prevId === nextId && sameStart) {
              // keep debug fresh though (which query produced the latest snapshot)
              return prev.debug?.qIndex === idx
                ? prev
                : {
                    ...prev,
                    debug: {
                      ...(prev.debug || {}),
                      qIndex: idx,
                      rowsCount: rows.length,
                    },
                  };
            }

            lastChosenRef.current = chosen;
            return chosen
              ? {
                  hasActive: true,
                  docId: chosen.id,
                  startTimeTs: chosen.startTs || null,
                  debug: {
                    qIndex: idx,
                    rowsCount: rows.length,
                    keys: chosen.keys,
                  },
                }
              : {
                  hasActive: false,
                  docId: null,
                  startTimeTs: null,
                  debug: {
                    qIndex: idx,
                    rowsCount: rows.length,
                    reason: "no-open",
                  },
                };
          });
        },
        (err) => {
          console.error("[ActiveClockProvider] snapshot error", err);
          setState((s) => ({
            ...s,
            debug: { ...(s.debug || {}), error: String(err?.message || err) },
          }));
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
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return (
    <ActiveClockContext.Provider value={value}>
      {children}
    </ActiveClockContext.Provider>
  );
}
