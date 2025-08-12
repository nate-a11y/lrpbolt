/* Proprietary and confidential. See LICENSE. */
// One-time reload per SW version to avoid loops
import { runOnce } from "./utils/runOnce";

const RELOAD_FLAG = "lrp:sw-reloaded-version";

export function setupServiceWorkerUpdater() {
  // VitePWA injects a virtual: registerSW if you want; but we handle manually via events
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    // When a new SW controls the page, reload ONCE per version
    const current = sessionStorage.getItem(RELOAD_FLAG);
    const active = navigator.serviceWorker.controller?.scriptURL || "unknown";
    if (current === active) return; // already reloaded for this version
    sessionStorage.setItem(RELOAD_FLAG, active);
    window.location.reload();
  });

  // Listen for waiting worker via message channel (from your sw, if you postMessage 'SW_UPDATED')
  navigator.serviceWorker?.addEventListener("message", (e) => {
    if (e?.data !== "SW_UPDATED") return;
    // Ask waiting worker to activate; controllerchange will trigger the single reload
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
  });
}

// Auto-run once
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  runOnce("install-updater", () => setupServiceWorkerUpdater());
}

