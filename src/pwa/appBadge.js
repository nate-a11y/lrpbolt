/* Proprietary and confidential. See LICENSE. */
import logError from "@/utils/logError.js";

export async function trySetAppBadge(value) {
  try {
    if ("setAppBadge" in navigator) {
      await navigator.setAppBadge(Math.max(1, Number(value) || 1));
    }
  } catch (error) {
    logError(error, { where: "appBadge", action: "set" });
  }
}

export async function clearAppBadge() {
  try {
    if ("clearAppBadge" in navigator) {
      await navigator.clearAppBadge();
    }
  } catch (error) {
    logError(error, { where: "appBadge", action: "clear" });
  }
}
