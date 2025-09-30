/* Proprietary and confidential. See LICENSE. */
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

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

export async function claimAnonymousToken({ token, userId }) {
  if (!token || !userId) return;
  try {
    const ref = doc(db, "fcmTokens", token);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data?.userId !== "anonymous") return;

    await setDoc(
      ref,
      { userId, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (error) {
    logError(error, { where: "fcmTokens", action: "claimAnonymousToken" });
  }
}
