/* Force-refresh on new SW; prevents stale asset 404s like timeUtils-*.js */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // new SW took control — reload to pick up new chunks
    window.location.reload();
  });
}
