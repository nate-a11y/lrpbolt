/* Proprietary and confidential. See LICENSE. */
import {
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

import { db } from "@/services/firebase";
import { loadDetectedSchema } from "@/config/timeclockSchema";

/** Finds the open session for the current user (using detected schema) and clocks it out. */
export async function clockOutActiveSession() {
  const u = getAuth().currentUser;
  if (!u) throw new Error("Not signed in");
  const schema = loadDetectedSchema();
  if (!schema?.collection || !schema?.idField) {
    throw new Error("Schema not detected");
  }

  const idValue = schema.idValueKind === "email" ? u.email : u.uid;
  if (!idValue) {
    throw new Error("Missing user identifier");
  }
  const q = query(
    collection(db, schema.collection),
    where(schema.idField, "==", idValue),
    limit(25),
  );
  const snap = await getDocs(q);
  const docs = snap.docs || [];
  // Choose the first doc with no end field or end === null or active === true
  for (const d of docs) {
    const data = d.data() || {};
    const endKey = schema.endKey || "endTime";
    const activeKey = schema.activeKey || "active";
    const hasEndField = Object.prototype.hasOwnProperty.call(data, endKey);
    const open =
      (Object.prototype.hasOwnProperty.call(data, activeKey) &&
        Boolean(data[activeKey])) ||
      !hasEndField ||
      data[endKey] === null;
    if (open) {
      await updateDoc(d.ref, {
        [endKey]: serverTimestamp(),
        [activeKey]: false,
      });
      return;
    }
  }
  throw new Error("No open session");
}
