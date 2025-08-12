if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
}
