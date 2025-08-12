/* Proprietary and confidential. See LICENSE. */
const RELOAD_FLAG = "lrp:sw-reloaded-version";

export function setupServiceWorkerUpdater() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const active = navigator.serviceWorker.controller?.scriptURL || "unknown";
    const already = sessionStorage.getItem(RELOAD_FLAG);
    if (already === active) return;                  // already reloaded for this version
    sessionStorage.setItem(RELOAD_FLAG, active);
    // single reload
    window.location.reload();
  });

  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e?.data !== "SW_UPDATED") return;
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
  });
}

// auto-init (safe)
if (typeof window !== "undefined") setupServiceWorkerUpdater();
