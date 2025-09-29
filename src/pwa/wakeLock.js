/* Proprietary and confidential. See LICENSE. */
// DEPRECATED: use useWakeLock(enabled) instead. This file is kept for backward compatibility.
import logError from "@/utils/logError.js";

let wakeLockSentinel = null;

export async function tryRequestWakeLock() {
  try {
    if ("wakeLock" in navigator && !wakeLockSentinel) {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
      wakeLockSentinel.addEventListener("release", () => {
        wakeLockSentinel = null;
      });
    }
  } catch (error) {
    logError(error, { where: "wakeLock", action: "request" });
  }
}

export async function releaseWakeLock() {
  try {
    if (wakeLockSentinel) {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
    }
  } catch (error) {
    logError(error, { where: "wakeLock", action: "release" });
  }
}
