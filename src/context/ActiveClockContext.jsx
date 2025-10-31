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

import {
  TIMECLOCK_SCHEMA_CANDIDATES,
  clearDetectedSchema,
  loadDetectedSchema,
  pickField,
  saveDetectedSchema,
} from "@/config/timeclockSchema";
import { DEBUG_TIMECLOCK } from "@/constants/debugFlags";
import { detectTimeclockSchemaOnce } from "@/services/detectTimeclockSchema";
import { db } from "@/services/firebase";
import logError from "@/utils/logError.js";

/**
 * Strategy:
 *  - If we have a cached HIGH-confidence schema and it returns rows, use it.
 *  - Else run MULTI-PROBE: subscribe to (collection x idField) for current uid/email.
 *      * Aggregate rows across listeners (no flicker/clobber).
 *      * On first non-empty snapshot, derive exact keys, mark confidence "high", SAVE, and unsubscribe others.
 *  - If a cached schema ever returns 0 rows N times in a row -> clear cache and re-probe.
 */
export const ActiveClockContext = createContext({
  hasActive: false,
  docId: null,
  startTimeTs: null,
  debug: null,
});

const MISS_LIMIT = 2; // consecutive empty snaps before we distrust cache

export default function ActiveClockProvider({ children }) {
  const [authSnap, setAuthSnap] = useState({ uid: null, email: null });
  const [lockedSchema, setLockedSchema] = useState(loadDetectedSchema()); // may be null or expired
  const [state, setState] = useState({
    hasActive: false,
    docId: null,
    startTimeTs: null,
    debug: null,
  });

  const missCountRef = useRef(0);
  const multiActiveRef = useRef(false);
  const unsubsRef = useRef([]);

  // Auth tracking
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (u) => {
      setAuthSnap({ uid: u?.uid || null, email: u?.email || null });
      // reset when user changes
      missCountRef.current = 0;
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
      } catch (error) {
        logError(error, { where: "ActiveClockProvider", action: "authUnsub" });
      }
    };
  }, []);

  // Helper to compute chosen doc from rows
  function pickOpenLatest(rows) {
    const openRows = rows.filter((r) => r.open);
    openRows.sort((a, b) => {
      const as = a.startTs?.seconds ?? -1;
      const bs = b.startTs?.seconds ?? -1;
      return bs - as;
    });
    return openRows[0] || null;
  }

  // Subscribe using LOCKED schema (fast path). If it looks wrong, we’ll drop it and multi-probe.
  useEffect(() => {
    const { uid, email } = authSnap;
    const s = lockedSchema;
    if (!s?.collection || !s?.idField) return undefined;

    const idValue = s.idValueKind === "email" ? email : uid;
    if (!idValue) return undefined;

    let unsub = null;
    try {
      const qRef = query(
        collection(db, s.collection),
        where(s.idField, "==", idValue),
        limit(25),
      );
      unsub = onSnapshot(
        qRef,
        (snap) => {
          const rows = [];
          snap.forEach((d) => {
            const data = d.data() || {};
            const startPick = s.startKey
              ? { key: s.startKey, value: data[s.startKey] }
              : pickField(data, TIMECLOCK_SCHEMA_CANDIDATES.startFields);
            const endPick = s.endKey
              ? { key: s.endKey, value: data[s.endKey] }
              : pickField(data, TIMECLOCK_SCHEMA_CANDIDATES.endFields);
            const activePick = s.activeKey
              ? { key: s.activeKey, value: data[s.activeKey] }
              : pickField(data, TIMECLOCK_SCHEMA_CANDIDATES.activeFlags);
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
              keys: {
                startKey: startPick.key,
                endKey: endPick.key,
                activeKey: activePick.key,
              },
            });
          });

          const chosen = pickOpenLatest(rows);

          // If this cached mapping is high confidence but yields nothing repeatedly, distrust and re-probe
          if (!rows.length) {
            missCountRef.current += 1;
          } else {
            missCountRef.current = 0;
          }
          if (missCountRef.current >= MISS_LIMIT) {
            clearDetectedSchema();
            setLockedSchema(null);
            return; // next effect run will multi-probe
          }

          if (DEBUG_TIMECLOCK) {
            // eslint-disable-next-line no-console
            console.info("[ActiveClock] locked snapshot", {
              schema: s,
              rows: rows.length,
              chosenId: chosen?.id || null,
              keys: chosen?.keys || null,
            });
          }

          setState(
            chosen
              ? {
                  hasActive: true,
                  docId: chosen.id,
                  startTimeTs: chosen.startTs || null,
                  debug: {
                    schema: s,
                    keys: chosen.keys,
                    count: rows.length,
                    path: "locked",
                  },
                }
              : {
                  hasActive: false,
                  docId: null,
                  startTimeTs: null,
                  debug: {
                    schema: s,
                    reason: "no-open",
                    count: rows.length,
                    path: "locked",
                  },
                },
          );
        },
        (err) => {
          logError(err, {
            where: "ActiveClockProvider",
            action: "lockedSnapshot",
          });
          clearDetectedSchema();
          setLockedSchema(null);
        },
      );
    } catch (e) {
      logError(e, {
        where: "ActiveClockProvider",
        action: "lockedSubscribe",
      });
      clearDetectedSchema();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Clearing schema on subscription error
      setLockedSchema(null);
    }

    return () => {
      try {
        unsub && unsub();
      } catch (error) {
        logError(error, {
          where: "ActiveClockProvider",
          action: "lockedUnsub",
        });
      }
    };
  }, [lockedSchema, authSnap]);

  // If we have no locked schema (or it was just cleared), run MULTI-PROBE and lock on first hit.
  useEffect(() => {
    const { uid, email } = authSnap;
    if (lockedSchema) return undefined; // locked path active
    if (!uid && !email) return undefined;
    if (multiActiveRef.current) return undefined;
    multiActiveRef.current = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Setting debug state for multi-probe
    setState((prev) => ({
      ...prev,
      debug: {
        ...prev.debug,
        path: "probe",
      },
    }));

    const unsubs = [];
    const idPairs = [];

    if (uid)
      TIMECLOCK_SCHEMA_CANDIDATES.userFields.forEach((f) =>
        idPairs.push({ field: f, value: uid, kind: "uid" }),
      );
    if (email)
      TIMECLOCK_SCHEMA_CANDIDATES.emailFields.forEach((f) =>
        idPairs.push({ field: f, value: email, kind: "email" }),
      );

    const cols = TIMECLOCK_SCHEMA_CANDIDATES.collections;

    // Install listeners across combos
    cols.forEach((coll) => {
      idPairs.forEach((id) => {
        try {
          const qRef = query(
            collection(db, coll),
            where(id.field, "==", id.value),
            limit(25),
          );
          const unsub = onSnapshot(
            qRef,
            (snap) => {
              const rows = [];
              snap.forEach((d) => {
                const data = d.data() || {};
                const startPick = pickField(
                  data,
                  TIMECLOCK_SCHEMA_CANDIDATES.startFields,
                );
                const endPick = pickField(
                  data,
                  TIMECLOCK_SCHEMA_CANDIDATES.endFields,
                );
                const activePick = pickField(
                  data,
                  TIMECLOCK_SCHEMA_CANDIDATES.activeFlags,
                );
                const hasEndField = !!endPick.key;
                const isActiveTrue = activePick.key
                  ? Boolean(activePick.value)
                  : null;
                const open =
                  isActiveTrue === true ||
                  !hasEndField ||
                  endPick.value === null;

                rows.push({
                  id: d.id,
                  startTs: startPick.value || null,
                  open,
                  keys: {
                    startKey: startPick.key,
                    endKey: endPick.key,
                    activeKey: activePick.key,
                  },
                });
              });

              // Lock on first non-empty snapshot
              if (rows.length > 0) {
                // choose latest open (may be null if all closed, but still a hit)
                const chosen =
                  rows
                    .slice()
                    .sort(
                      (a, b) =>
                        (b.startTs?.seconds ?? -1) - (a.startTs?.seconds ?? -1),
                    )[0] || null;
                const newSchema = {
                  collection: coll,
                  idField: id.field,
                  idValueKind: id.kind,
                  startKey: chosen?.keys?.startKey || null,
                  endKey: chosen?.keys?.endKey || null,
                  activeKey: chosen?.keys?.activeKey || null,
                  confidence: "high",
                };
                saveDetectedSchema(newSchema);
                setLockedSchema(newSchema);

                if (DEBUG_TIMECLOCK) {
                  // eslint-disable-next-line no-console
                  console.info("[ActiveClock] probe locked schema", newSchema);
                }

                // Tear down all probe listeners
                unsubs.forEach((u) => {
                  try {
                    u && u();
                  } catch (error) {
                    logError(error, {
                      where: "ActiveClockProvider",
                      action: "probeUnsub",
                    });
                  }
                });
                multiActiveRef.current = false;
              }

              // If all listeners reported empty and none locked, we do nothing; UI remains no-active until user creates docs.
            },
            (err) => {
              logError(err, {
                where: "ActiveClockProvider",
                action: "probeSnapshot",
                details: { collection: coll, field: id.field },
              });
            },
          );
          unsubs.push(unsub);
        } catch (e) {
          logError(e, {
            where: "ActiveClockProvider",
            action: "probeSubscribe",
            details: { collection: coll, field: id.field },
          });
        }
      });
    });

    // Fallback: also kick a one-shot heuristic (non-persistent, not saved)
    (async () => {
      try {
        const guess = await detectTimeclockSchemaOnce();
        if (guess?.confidence !== "fallback" && !lockedSchema) {
          // Do not save yet; locked path will save once it sees rows
          // If you want to pre-lock on a "low" guess, uncomment next line (not recommended)
          // setLockedSchema(guess);
        }
      } catch (e) {
        logError(e, {
          where: "ActiveClockProvider",
          action: "detectOnce",
        });
      }
    })();

    unsubsRef.current = unsubs;

    return () => {
      unsubs.forEach((u) => {
        try {
          u && u();
        } catch (error) {
          logError(error, {
            where: "ActiveClockProvider",
            action: "probeCleanup",
          });
        }
      });
      unsubsRef.current = [];
      multiActiveRef.current = false;
    };
  }, [lockedSchema, authSnap]);

  const value = useMemo(() => state, [state]);
  return (
    <ActiveClockContext.Provider value={value}>
      {children}
    </ActiveClockContext.Provider>
  );
}
