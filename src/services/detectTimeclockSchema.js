/* Proprietary and confidential. See LICENSE. */
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";

import {
  TIMECLOCK_SCHEMA_CANDIDATES,
  loadDetectedSchema,
  saveDetectedSchema,
  pickField,
} from "@/config/timeclockSchema";
import { db } from "@/services/firebase";

/**
 * Tries (collection x identifierField) combinations to find at least 1 open doc.
 * Open = active flag true OR no end field OR end field === null.
 * Returns a schema { collection, idField, idValueKind: "uid"|"email",
 *                    startKey, endKey, activeKey }
 */
export async function detectTimeclockSchema() {
  const cached = loadDetectedSchema();
  if (cached?.collection && cached?.idField) {
    return cached;
  }

  const auth = getAuth();
  const uid = auth.currentUser?.uid || null;
  const email = auth.currentUser?.email || null;

  const idCandidates = [];
  if (uid) {
    TIMECLOCK_SCHEMA_CANDIDATES.userFields.forEach((f) =>
      idCandidates.push({ field: f, value: uid, kind: "uid" }),
    );
  }
  if (email) {
    TIMECLOCK_SCHEMA_CANDIDATES.emailFields.forEach((f) =>
      idCandidates.push({ field: f, value: email, kind: "email" }),
    );
  }

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

        // Inspect docs to choose keys
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
        };

        // Cache and return; even if not "open" yet, we now know the field names
        saveDetectedSchema(schema);
        return schema;
      } catch (e) {
        console.error(
          "[detectTimeclockSchema] probe failed",
          coll,
          id.field,
          e,
        );
      }
    }
  }

  // Fallback minimal
  const fallback = {
    collection: TIMECLOCK_SCHEMA_CANDIDATES.collections[0],
    idField: TIMECLOCK_SCHEMA_CANDIDATES.userFields[0],
    idValueKind: "uid",
    startKey: TIMECLOCK_SCHEMA_CANDIDATES.startFields[0],
    endKey: TIMECLOCK_SCHEMA_CANDIDATES.endFields[0],
    activeKey: TIMECLOCK_SCHEMA_CANDIDATES.activeFlags[0],
  };
  saveDetectedSchema(fallback);
  return fallback;
}
