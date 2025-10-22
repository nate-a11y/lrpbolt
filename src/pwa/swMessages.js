/* Proprietary and confidential. See LICENSE. */
let _attached = false;
const _pending = []; // {type, ts}
const _MAX = 8;
function _enqueue(type) {
  try {
    _pending.push({ type, ts: Date.now() });
    while (_pending.length > _MAX) _pending.shift();
  } catch (e) {
    console.error("[swMessages] enqueue failed", e);
  }
}

export function consumePendingSwEvent(type) {
  try {
    const i = _pending.findIndex((e) => e.type === type);
    if (i >= 0) {
      _pending.splice(i, 1);
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
    if (!("serviceWorker" in navigator)) {
      _attached = true;
      return;
    }
    navigator.serviceWorker.addEventListener("message", (e) => {
      const t = e?.data?.type;
      try {
        if (t === "SW_OPEN_TIME_CLOCK") {
          _enqueue(t);
          window.dispatchEvent(new CustomEvent("lrp:open-timeclock"));
        } else if (t === "SW_CLOCK_OUT_REQUEST") {
          _enqueue(t);
          window.dispatchEvent(new CustomEvent("lrp:clockout-request"));
        } else if (t === "SW_NAVIGATE_TO_TICKET") {
          _enqueue(t);
          window.dispatchEvent(
            new CustomEvent("lrp:navigate-to-ticket", {
              detail: { ticketId: e?.data?.ticketId },
            }),
          );
        } else if (t === "CLOCKOUT_OK") {
          _enqueue(t);
          window.dispatchEvent(
            new CustomEvent("lrp:clockout-success", { detail: e?.data || {} }),
          );
        } else if (t === "CLOCKOUT_FAILED") {
          _enqueue(t);
          window.dispatchEvent(
            new CustomEvent("lrp:clockout-failure", { detail: e?.data || {} }),
          );
        }
      } catch (err) {
        console.error("[swMessages] dispatch failed", err);
      }
    });
    _attached = true;
  } catch (e) {
    console.error("[swMessages] init failed", e);
    _attached = true;
  }
}
