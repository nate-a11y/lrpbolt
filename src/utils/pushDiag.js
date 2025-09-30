/* Proprietary and confidential. See LICENSE. */

export function diagPushSupport() {
  if (typeof window === "undefined") {
    return { hasNotifAPI: false, hasSW: false, hasPush: false };
  }
  return {
    hasNotifAPI: "Notification" in window,
    hasSW: "serviceWorker" in navigator,
    hasPush: "PushManager" in window,
  };
}
