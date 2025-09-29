/* Proprietary and confidential. See LICENSE. */
import { openTimeClockModal, requestClockOut } from "@/services/uiBus";
import logError from "@/utils/logError.js";

let initialized = false;

export function initServiceWorkerMessageBridge() {
  if (initialized) return;
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
  initialized = true;
  navigator.serviceWorker.addEventListener("message", (event) => {
    const message = event?.data || {};
    if (message.type === "LRP_OPEN_CLOCK") {
      openTimeClockModal();
    } else if (message.type === "LRP_CLOCK_OUT_REQUEST") {
      try {
        requestClockOut();
      } catch (error) {
        logError(error, { where: "swMessages", action: "clockOutRequest" });
      }
    }
  });
}
