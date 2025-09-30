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
import {
  stopPersistentClockNotification,
  clearClockNotification,
} from "@/pwa/clockNotifications";
import { clearPersistentClockNotification } from "@/services/clockNotifications.js";
import logError from "@/utils/logError.js";

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
      try {
        await stopPersistentClockNotification();
      } catch (error) {
        logError(error, { where: "timeclockActions", action: "stopSticky" });
      }
      try {
        await clearClockNotification();
      } catch (error) {
        logError(error, { where: "timeclockActions", action: "clearClock" });
      }
      try {
        await clearPersistentClockNotification();
      } catch (error) {
        logError(error, {
          where: "timeclockActions",
          action: "clearPersistent",
        });
      }
      return;
    }
  }
  throw new Error("No open session");
}
