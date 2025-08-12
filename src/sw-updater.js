if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" }).catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
}
