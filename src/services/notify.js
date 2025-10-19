import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import AppError from "@/utils/AppError.js";
import logError from "@/utils/logError.js";
import { db } from "@/services/firebase.js";
import { withExponentialBackoff } from "@/services/retry.js";
import { COLLECTIONS } from "@/constants/collections.js";

export async function enqueueNotification(data) {
  if (!data || typeof data !== "object") {
    throw new AppError(
      "Notification payload missing",
      "NOTIFY_PAYLOAD_INVALID",
    );
  }

  try {
    await withExponentialBackoff(async () => {
      await addDoc(collection(db, COLLECTIONS.NOTIFY_QUEUE), {
        ...data,
        createdAt: serverTimestamp(),
        status: "queued",
        attempts: 0,
      });
    });
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError(
            error?.message || "Failed to enqueue notification",
            "NOTIFY_ENQUEUE_FAILED",
          );
    logError(appErr, { where: "notify.enqueueNotification" });
    throw appErr;
  }
}
