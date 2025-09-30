/* Proprietary and confidential. See LICENSE. */
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "@/utils/firebaseInit";
import logError from "@/utils/logError.js";

export async function saveUserPushToken({ userId, token, deviceInfo = {} }) {
  if (!userId || !token) return;
  try {
    const ref = doc(db, "fcmTokens", token);
    await setDoc(
      ref,
      {
        userId,
        token,
        updatedAt: serverTimestamp(),
        deviceInfo,
      },
      { merge: true },
    );
  } catch (error) {
    logError(error, { where: "fcmTokens", action: "saveUserPushToken" });
  }
}
