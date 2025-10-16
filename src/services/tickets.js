/* Proprietary and confidential. See LICENSE. */
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
} from "firebase/firestore";

import logError from "@/utils/logError.js";
import { db } from "@/services/firebase.js";

export function subscribeTickets({ onData, onError } = {}) {
  const q = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const rows = [];
      snapshot.forEach((d) => {
        rows.push({ id: d.id, ...(d.data() || {}) });
      });
      if (onData) onData(rows);
    },
    (error) => {
      logError(error, { area: "tickets", action: "subscribeTickets" });
      if (onError) onError(error);
    },
  );
}

export async function snapshotTicketsByIds(ids = []) {
  if (!ids?.length) return [];
  const results = [];
  try {
    await Promise.all(
      ids.map(async (id) => {
        const ref = doc(db, "tickets", id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          results.push({ id, data: snap.data() });
        }
      }),
    );
  } catch (err) {
    logError(err, {
      area: "tickets",
      action: "snapshotTicketsByIds",
      ids,
    });
    throw err;
  }
  return results;
}

export async function deleteTicketsByIds(ids = []) {
  if (!ids?.length) return;
  const batch = writeBatch(db);
  try {
    ids.forEach((id) => {
      const ref = doc(db, "tickets", id);
      batch.delete(ref);
    });
    await batch.commit();
  } catch (err) {
    logError(err, { area: "tickets", action: "deleteTicketsByIds", ids });
    throw err;
  }
}

export async function restoreTickets(deletedDocs = []) {
  if (!deletedDocs?.length) return;
  const batch = writeBatch(db);
  try {
    deletedDocs.forEach(({ id, data }) => {
      const ref = doc(db, "tickets", id);
      batch.set(ref, data, { merge: false });
    });
    await batch.commit();
  } catch (err) {
    logError(err, {
      area: "tickets",
      action: "restoreTickets",
      count: deletedDocs.length,
    });
    throw err;
  }
}
