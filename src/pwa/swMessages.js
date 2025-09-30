/* Proprietary and confidential. See LICENSE. */
import logError from "@/utils/logError.js";

let initialized = false;
const pending = {
  clockOut: false,
  openClock: false,
};

function markAndDispatch(name, key) {
  pending[key] = true;
  window.dispatchEvent(new CustomEvent(name));
}

export function consumePendingSwEvent(key) {
  if (!pending[key]) return false;
  pending[key] = false;
  return true;
}

export function initServiceWorkerMessageBridge() {
  if (initialized) return;
  try {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.addEventListener("message", (event) => {
      const message = event?.data || {};
      try {
        const type = message?.type;
        if (!type) return;
        if (type === "SW_OPEN_TIME_CLOCK") {
          markAndDispatch("lrp:open-timeclock", "openClock");
        } else if (type === "SW_CLOCK_OUT_REQUEST") {
          markAndDispatch("lrp:clockout-request", "clockOut");
        }
      } catch (err) {
        logError(err, { where: "swMessages", action: "dispatch" });
      }
    });

    initialized = true;
  } catch (error) {
    logError(error, { where: "swMessages", action: "init" });
  }
}
