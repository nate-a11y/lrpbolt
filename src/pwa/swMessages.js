/* Proprietary and confidential. See LICENSE. */

// Single attachment guard
let _attached = false;

/**
 * Attaches a window-level listener for Service Worker messages immediately.
 * Safe to call multiple times. Does NOT wait for registration/ready.
 * Dispatches:
 *  - "lrp:open-timeclock"
 *  - "lrp:clockout-request"
 */
export function initServiceWorkerMessageBridge() {
  try {
    if (_attached) return;
    if (!("serviceWorker" in navigator)) {
      _attached = true; // prevent retry loops in non-SW envs
      return;
    }

    navigator.serviceWorker.addEventListener("message", (e) => {
      const msg = e?.data || {};
      try {
        if (msg?.type === "SW_OPEN_TIME_CLOCK") {
          window.dispatchEvent(new CustomEvent("lrp:open-timeclock"));
        } else if (msg?.type === "SW_CLOCK_OUT_REQUEST") {
          window.dispatchEvent(new CustomEvent("lrp:clockout-request"));
        }
      } catch (err) {
        console.error("[swMessages] dispatch failed", err);
      }
    });

    // Also handle late controller handover on first load
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // no-op: the 'message' listener is global and already attached
      // but we keep this hook in case we want to log or re-warm later
    });

    _attached = true;
  } catch (e) {
    console.error("[swMessages] init failed", e);
    _attached = true;
  }
}
