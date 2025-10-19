import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

import { app } from "@/services/firebase.js";
import logError from "@/utils/logError.js";

const storage = getStorage(app);
const db = getFirestore(app);

function createAttachmentId(file) {
  const base = `${Date.now()}_${file?.name || "attachment"}`;
  return base.replace(/[\s\\/#?%*:|"<>]/g, "_");
}

export async function uploadTicketFiles(ticketId, files, user) {
  const safeId = String(ticketId || "").trim();
  if (!safeId || !Array.isArray(files) || !files.length) {
    return;
  }

  let lastError = null;

  for (const file of files) {
    if (!file) continue;
    try {
      const attachmentId = createAttachmentId(file);
      const storagePath = `issueTickets/${safeId}/${attachmentId}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      await setDoc(
        doc(db, "issueTickets", safeId, "attachments", attachmentId),
        {
          url,
          storagePath,
          name: file.name,
          size: file.size,
          contentType: file.type,
          uploader: {
            userId: user?.uid || "unknown",
            displayName: user?.displayName || "Unknown",
          },
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      logError(err, { where: "uploadTicketFiles", ticketId: safeId });
      lastError = err;
    }
  }

  if (lastError) {
    throw lastError;
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
      "issueTickets",
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
          where: "subscribeTicketAttachments",
          ticketId: safeId,
        });
        cb({ error });
      },
    );
  } catch (error) {
    logError(error, { where: "subscribeTicketAttachments", ticketId: safeId });
    cb({ error });
    return () => {};
  }
}
