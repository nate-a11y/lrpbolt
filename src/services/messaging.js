import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  onSnapshot,
} from "firebase/firestore";

import { db } from "../utils/firebaseInit";
import AppError from "../utils/AppError.js";
import logError from "../utils/logError.js";
import retry from "../utils/retry.js";

export async function enqueueSms({ to, body, context = {} }) {
  try {
    return await retry(
      () =>
        addDoc(collection(db, "outboundMessages"), {
          to,
          body,
          channel: "sms",
          status: "queued",
          context,
          createdAt: serverTimestamp(),
        }),
      {
        tries: 2,
        onError: (err, attempt) =>
          logError(err, { where: "messaging", action: "enqueueSms", attempt }),
      },
    );
  } catch (err) {
    const appErr =
      err instanceof AppError
        ? err
        : new AppError(err.message || "enqueueSms failed", "FIRESTORE_WRITE", {
            to,
          });
    logError(appErr, { where: "messaging", action: "enqueueSms" });
    throw appErr;
  }
}

export function watchMessage(ref, cb) {
  try {
    return onSnapshot(
      doc(db, "outboundMessages", ref.id),
      (s) => s.exists() && cb(s.data()),
    );
  } catch (err) {
    const appErr =
      err instanceof AppError
        ? err
        : new AppError(
            err.message || "watchMessage failed",
            "FIRESTORE_LISTEN",
            {
              id: ref?.id,
            },
          );
    logError(appErr, { where: "messaging", action: "watchMessage" });
    throw appErr;
  }
}
