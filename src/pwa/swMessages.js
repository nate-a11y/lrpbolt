/* Proprietary and confidential. See LICENSE. */

// Attach-once guard
let _attached = false;

// In-memory FIFO for cold-start buffering of SW events
const _pending = []; // { type, ts }
const _MAX = 8;
function _enqueue(type) {
  try {
    _pending.push({ type, ts: Date.now() });
    while (_pending.length > _MAX) _pending.shift();
  } catch (error) {
    console.error("[swMessages] enqueue failed", error);
  }
}

/** Drain a pending SW event (oldest of this type). */
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

/** Attach SW->window message bridge immediately. Idempotent. */
export function initServiceWorkerMessageBridge() {
  try {
    if (_attached) return;
    if (!("serviceWorker" in navigator)) {
      _attached = true;
      return;
    }

    navigator.serviceWorker.addEventListener("message", (e) => {
      const msg = e?.data || {};
      const t = msg?.type;
      try {
        if (t === "SW_OPEN_TIME_CLOCK") {
          _enqueue(t);
          window.dispatchEvent(new CustomEvent("lrp:open-timeclock"));
        } else if (t === "SW_CLOCK_OUT_REQUEST") {
          _enqueue(t);
          window.dispatchEvent(new CustomEvent("lrp:clockout-request"));
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
