/* Proprietary and confidential. See LICENSE. */
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";

import { db } from "@/services/firebase";
import {
  TIMECLOCK_SCHEMA_CANDIDATES,
  pickField,
} from "@/config/timeclockSchema";

/**
 * Probes combinations and returns a schema with confidence:
 * - {confidence:"high"} when actual docs are found (PERSIST THIS)
 * - {confidence:"low"} when field names inferred from docs but not validated open
 * - {confidence:"fallback"} when nothing found (DO NOT PERSIST)
 */
export async function detectTimeclockSchemaOnce() {
  const auth = getAuth();
  const uid = auth.currentUser?.uid || null;
  const email = auth.currentUser?.email || null;

  const idCandidates = [];
  if (uid)
    TIMECLOCK_SCHEMA_CANDIDATES.userFields.forEach((f) =>
      idCandidates.push({ field: f, value: uid, kind: "uid" }),
    );
  if (email)
    TIMECLOCK_SCHEMA_CANDIDATES.emailFields.forEach((f) =>
      idCandidates.push({ field: f, value: email, kind: "email" }),
    );

  for (const coll of TIMECLOCK_SCHEMA_CANDIDATES.collections) {
    for (const id of idCandidates) {
      try {
        const qRef = query(
          collection(db, coll),
          where(id.field, "==", id.value),
          limit(10),
        );
        const snap = await getDocs(qRef);
        const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
        if (!docs.length) continue;

        const first = docs[0].data;
        const startPick = pickField(
          first,
          TIMECLOCK_SCHEMA_CANDIDATES.startFields,
        );
        const endPick = pickField(first, TIMECLOCK_SCHEMA_CANDIDATES.endFields);
        const activePick = pickField(
          first,
          TIMECLOCK_SCHEMA_CANDIDATES.activeFlags,
        );

        const schema = {
          collection: coll,
          idField: id.field,
          idValueKind: id.kind, // "uid"|"email"
          startKey: startPick.key || null,
          endKey: endPick.key || null,
          activeKey: activePick.key || null,
          confidence: "low", // upgraded to "high" when we confirm rows in live sub
        };

        return schema; // DO NOT persist yet; provider will confirm and persist
      } catch (e) {
        console.error(
          "[detectTimeclockSchemaOnce] probe failed",
          coll,
          id.field,
          e,
        );
      }
    }
  }

  return {
    collection: TIMECLOCK_SCHEMA_CANDIDATES.collections[0],
    idField: TIMECLOCK_SCHEMA_CANDIDATES.userFields[0],
    idValueKind: "uid",
    startKey: TIMECLOCK_SCHEMA_CANDIDATES.startFields[0],
    endKey: TIMECLOCK_SCHEMA_CANDIDATES.endFields[0],
    activeKey: TIMECLOCK_SCHEMA_CANDIDATES.activeFlags[0],
    confidence: "fallback",
  };
}
