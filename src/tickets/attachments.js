import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { app, db } from "@/services/firebase.js";
import logError from "@/utils/logError.js";
import { COLLECTIONS } from "@/constants/collections.js";

const storage = getStorage(app);

export async function uploadTicketFiles(ticketId, files = [], user) {
  const safeId = String(ticketId || "").trim();
  if (!safeId || !Array.isArray(files) || !files.length) {
    return;
  }

  for (const file of files) {
    if (!file) continue;
    try {
      const key = `issueTickets/${safeId}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, key);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      await setDoc(
        doc(db, COLLECTIONS.ISSUE_TICKETS, safeId, "attachments", key),
        {
          url,
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
          uploader: {
            userId: user?.uid || "unknown",
            displayName: user?.displayName || user?.name || "Unknown",
          },
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      logError(err, { where: "ticket.uploadTicketFiles", ticketId: safeId });
      throw err;
    }
  }
}

export function subscribeTicketAttachments(ticketId, callback) {
  const safeId = String(ticketId || "").trim();
  if (!safeId) {
    return () => {};
  }
  const cb = typeof callback === "function" ? callback : () => {};

  try {
    const attachmentsRef = collection(
      db,
      COLLECTIONS.ISSUE_TICKETS,
      safeId,
      "attachments",
    );
    const q = query(attachmentsRef, orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() || {}),
        }));
        cb({ rows });
      },
      (error) => {
        logError(error, {
          where: "ticket.subscribeAttachments",
          ticketId: safeId,
        });
        cb({ error });
      },
    );
  } catch (error) {
    logError(error, { where: "ticket.subscribeAttachments", ticketId: safeId });
    cb({ error });
    return () => {};
  }
}
