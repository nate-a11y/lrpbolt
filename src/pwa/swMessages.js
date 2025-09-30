/* Proprietary and confidential. See LICENSE. */

// Single attachment guard
let _attached = false;

// Tiny in-memory FIFO for cold-start buffering
const _pending = []; // { type: "SW_OPEN_TIME_CLOCK" | "SW_CLOCK_OUT_REQUEST", ts: number }
const _MAX = 8;

/** Push into pending (bounded). */
function _enqueue(type) {
  try {
    _pending.push({ type, ts: Date.now() });
    while (_pending.length > _MAX) _pending.shift();
  } catch {
    // ignore enqueue failure
  }
}

/**
 * Returns true if a pending event of this type existed and removes the oldest one.
 * Safe to call from React effects to drain any pre-mount events.
 */
export function consumePendingSwEvent(type) {
  try {
    const idx = _pending.findIndex((e) => e.type === type);
    if (idx >= 0) {
      _pending.splice(idx, 1);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Attach SW message -> window events, *and* queue for cold start. Idempotent. */
export function initServiceWorkerMessageBridge() {
  try {
    if (_attached) return;
    if (!("serviceWorker" in navigator)) {
      _attached = true;
      return;
    }

    navigator.serviceWorker.addEventListener("message", (e) => {
      const msg = e?.data || {};
      const type = msg?.type;
      try {
        if (type === "SW_OPEN_TIME_CLOCK") {
          // Queue first so early consumers can drain, then dispatch window event.
          _enqueue(type);
          window.dispatchEvent(new CustomEvent("lrp:open-timeclock"));
        } else if (type === "SW_CLOCK_OUT_REQUEST") {
          _enqueue(type);
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
