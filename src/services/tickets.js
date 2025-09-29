import {
  getFirestore,
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";

import logError from "@/utils/logError.js";

const db = getFirestore();

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
      logError(error);
      if (onError) onError(error);
    },
  );
}

export async function deleteTicketById(docId) {
  if (!docId) throw new Error("deleteTicketById: missing docId");
  await deleteDoc(doc(db, "tickets", docId));
}

export async function deleteTicketsByIds(docIds = []) {
  for (const id of docIds) {
    await deleteTicketById(id);
  }
}
