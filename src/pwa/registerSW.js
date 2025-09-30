/* Proprietary and confidential. See LICENSE. */
import logError from "@/utils/logError.js";

const RELOAD_DELAY_MS = 50;
const RELOAD_FLAG_KEY = "lrp-sw-reloaded";

export async function registerSW() {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    try {
      await registration.update();
    } catch (error) {
      logError(error, { where: "registerSW", action: "update" });
    }

    await navigator.serviceWorker.ready;

    const channel = new MessageChannel();
    const ack = new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        resolve(null);
      }, 250);
      channel.port1.onmessage = (event) => {
        window.clearTimeout(timeout);
        resolve(event?.data || null);
      };
    });

    navigator.serviceWorker.controller?.postMessage({ type: "PING" }, [
      channel.port2,
    ]);

    const response = await ack.catch((error) => {
      logError(error, { where: "registerSW", action: "ping-ack" });
      return null;
    });

    if (response?.type === "PONG") {
      sessionStorage.removeItem(RELOAD_FLAG_KEY);
    }

    if (!response || response.type !== "PONG") {
      setTimeout(() => {
        try {
          const hasController = Boolean(navigator.serviceWorker.controller);
          const alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG_KEY);
          if (!hasController && !alreadyReloaded) {
            sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
            window.location.reload();
          }
        } catch (error) {
          logError(error, { where: "registerSW", action: "reload" });
        }
      }, RELOAD_DELAY_MS);
    }

    return registration;
  } catch (error) {
    logError(error, { where: "registerSW", action: "register" });
    return null;
  }
}
