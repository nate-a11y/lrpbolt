/* Proprietary and confidential. See LICENSE. */
/**
 * Unregister any service workers that are not our canonical /sw.js.
 * Also closes any leftover "lrp-clock" notifications from old workers.
 */
export async function purgeOtherServiceWorkers() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const keepEndsWith = "/sw.js";
    for (const registration of registrations) {
      const scriptUrl =
        registration.active?.scriptURL ||
        registration.installing?.scriptURL ||
        registration.waiting?.scriptURL ||
        "";
      const isCanonical = scriptUrl.endsWith(keepEndsWith);
      if (!isCanonical) {
        try {
          await registration.unregister();
        } catch (error) {
          console.error("[purgeSW] unregister failed", error);
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
  } catch (error) {
    console.error("[purgeSW] failed", error);
  }
}

/** Small diagnostic helper for console use */
export async function logSWStatus() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    console.info("No SW support");
    return;
  }
  const registrations = await navigator.serviceWorker.getRegistrations();
  console.table(
    registrations.map((registration) => ({
      scope: registration.scope,
      script:
        registration.active?.scriptURL ||
        registration.installing?.scriptURL ||
        registration.waiting?.scriptURL ||
        "—",
    })),
  );
}
