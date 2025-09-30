/* Proprietary and confidential. See LICENSE. */
export async function registerSW() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
    return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    try {
      await reg.update();
    } catch (error) {
      console.error("[registerSW] update failed", error);
    }
    try {
      await navigator.serviceWorker.ready;
    } catch (error) {
      console.error("[registerSW] ready wait failed", error);
    }
    try {
      reg.active?.postMessage?.({ type: "PING" });
    } catch (error) {
      console.error("[registerSW] ping failed", error);
    }
    return reg;
  } catch (error) {
    console.error("[registerSW] failed", error);
    return null;
  }
}
