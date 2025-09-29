/* Proprietary and confidential. See LICENSE. */
import { createContext, useEffect, useMemo, useState } from "react";
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
  pickField,
  loadDetectedSchema,
} from "@/config/timeclockSchema";
import { detectTimeclockSchema } from "@/services/detectTimeclockSchema";
import { db } from "@/services/firebase";

/**
 * Uses a detected schema (cached) to subscribe to the correct collection/field.
 * Aggregation is no longer needed—we subscribe to ONE mapping (the detected one).
 * Resubscribes when auth UID/email changes or when detection yields a new mapping.
 */
export const ActiveClockContext = createContext({
  hasActive: false,
  docId: null,
  startTimeTs: null,
  debug: null,
});

export default function ActiveClockProvider({ children }) {
  const [authSnapshot, setAuthSnapshot] = useState({ uid: null, email: null });
  const [schema, setSchema] = useState(loadDetectedSchema());
  const [state, setState] = useState({
    hasActive: false,
    docId: null,
    startTimeTs: null,
    debug: null,
  });

  // Track auth (uid/email) so we can choose identifier value
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (u) => {
      setAuthSnapshot({ uid: u?.uid || null, email: u?.email || null });
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

  // Detect schema once per session (or when auth changes and we had no mapping)
  useEffect(() => {
    if (!authSnapshot.uid && !authSnapshot.email) return;
    if (schema?.collection && schema?.idField) return;

    let active = true;
    (async () => {
      try {
        const detected = await detectTimeclockSchema();
        if (active) setSchema(detected);
      } catch (e) {
        console.error("[ActiveClockProvider] detection failed", e);
      }
    })();

    return () => {
      active = false;
    };
  }, [authSnapshot, schema]);

  // Subscribe using the detected schema
  useEffect(() => {
    if (!schema?.collection || !schema?.idField) return undefined;

    const idValue =
      schema.idValueKind === "email" ? authSnapshot.email : authSnapshot.uid;
    if (!idValue) return undefined;

    const colRef = collection(db, schema.collection);
    const unsub = onSnapshot(
      query(colRef, where(schema.idField, "==", idValue), limit(25)),
      (snap) => {
        const rows = [];
        snap.forEach((d) => {
          const data = d.data() || {};
          const startPick = schema.startKey
            ? { key: schema.startKey, value: data[schema.startKey] }
            : pickField(data, TIMECLOCK_SCHEMA_CANDIDATES.startFields);
          const endPick = schema.endKey
            ? { key: schema.endKey, value: data[schema.endKey] }
            : pickField(data, TIMECLOCK_SCHEMA_CANDIDATES.endFields);
          const activePick = schema.activeKey
            ? { key: schema.activeKey, value: data[schema.activeKey] }
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

        // choose latest open
        const openRows = rows.filter((r) => r.open);
        const chosen =
          openRows.slice().sort((a, b) => {
            const as = a.startTs?.seconds ?? -1;
            const bs = b.startTs?.seconds ?? -1;
            return bs - as;
          })[0] || null;

        setState(
          chosen
            ? {
                hasActive: true,
                docId: chosen.id,
                startTimeTs: chosen.startTs || null,
                debug: { schema, keys: chosen.keys, count: rows.length },
              }
            : {
                hasActive: false,
                docId: null,
                startTimeTs: null,
                debug: { schema, reason: "no-open", count: rows.length },
              },
        );
      },
      (err) => {
        console.error("[ActiveClockProvider] snapshot error", err);
        setState({
          hasActive: false,
          docId: null,
          startTimeTs: null,
          debug: { schema, error: String(err?.message || err) },
        });
      },
    );

    return () => {
      try {
        unsub();
      } catch (e) {
        console.error(e);
      }
    };
  }, [authSnapshot, schema]);

  const value = useMemo(() => state, [state]);
  return (
    <ActiveClockContext.Provider value={value}>
      {children}
    </ActiveClockContext.Provider>
  );
}
