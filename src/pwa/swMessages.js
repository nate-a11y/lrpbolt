/* Proprietary and confidential. See LICENSE. */
let _attached = false;
const _pending = [];
const _MAX = 8;
function _enqueue(type) {
  try {
    _pending.push({ type, ts: Date.now() });
    while (_pending.length > _MAX) _pending.shift();
  } catch (error) {
    console.error("[swMessages] enqueue failed", error);
  }
}
export function consumePendingSwEvent(type) {
  try {
    const index = _pending.findIndex((entry) => entry.type === type);
    if (index >= 0) {
      _pending.splice(index, 1);
      return true;
    }
    return false;
  } catch (error) {
    console.error("[swMessages] consume failed", error);
    return false;
  }
}
export function initServiceWorkerMessageBridge() {
  try {
    if (_attached) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      _attached = true;
      return;
    }
    navigator.serviceWorker.addEventListener("message", (event) => {
      const type = event?.data?.type;
      try {
        if (type === "SW_OPEN_TIME_CLOCK") {
          _enqueue(type);
          window.dispatchEvent(new CustomEvent("lrp:open-timeclock"));
        } else if (type === "SW_CLOCK_OUT_REQUEST") {
          _enqueue(type);
          window.dispatchEvent(new CustomEvent("lrp:clockout-request"));
        }
      } catch (error) {
        console.error("[swMessages] dispatch failed", error);
      }
    });
    _attached = true;
  } catch (error) {
    console.error("[swMessages] init failed", error);
    _attached = true;
  }
}
