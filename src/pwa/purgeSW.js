/* Proprietary and confidential. See LICENSE. */
/** Unregister any SWs not ending with /sw.js */
export async function purgeOtherServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      const url =
        reg.active?.scriptURL ||
        reg.waiting?.scriptURL ||
        reg.installing?.scriptURL ||
        "";
      if (!url.endsWith("/sw.js")) {
        try {
          await reg.unregister();
        } catch (e) {
          console.error("[purgeSW] unregister failed", e);
        }
      }
    }
    try {
      navigator.serviceWorker.controller?.postMessage?.({
        type: "CLEAR_CLOCK_FROM_SW",
      });
    } catch (error) {
      console.warn("[purgeSW] clear message failed", error);
    }
  } catch (e) {
    console.error("[purgeSW] failed", e);
  }
}
