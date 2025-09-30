/* Proprietary and confidential. See LICENSE. */
import { openTimeClockModal } from "@/services/uiBus";
import { clockOutActiveSession } from "@/services/timeclockActions";

/** Listens for actions from the PiP window and routes them to the app. */
let chan;
export function initPiPBridge() {
  try {
    if (chan) return;
    if (!("BroadcastChannel" in window)) return;
    chan = new BroadcastChannel("lrp-clock-actions");
    chan.onmessage = async (e) => {
      const msg = e?.data || {};
      try {
        if (msg?.type === "open") {
          openTimeClockModal();
        } else if (msg?.type === "clockout") {
          await clockOutActiveSession();
        }
      } catch (err) {
        console.error("[PiPBridge] action failed", err);
      }
    };
  } catch (e) {
    console.error("[PiPBridge] init failed", e);
  }
}
