/* Proprietary and confidential. See LICENSE. */
// Unregister all service workers EXCEPT the Firebase Messaging SW.
// Run once per session to prevent reload loops from old SWs.
const KEY = "lrp:sw:cleaned";

export async function killRogueServiceWorkers() {
  try {
    if (!("serviceWorker" in navigator)) return;
    if (sessionStorage.getItem(KEY) === "1") return;

    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.map(async (reg) => {
        const url =
          reg.active?.scriptURL ||
          reg.installing?.scriptURL ||
          reg.waiting?.scriptURL ||
          "";
        // Keep only the FCM SW at the site root
        if (!url.endsWith("/firebase-messaging-sw.js")) {
          try {
            await reg.unregister();
          } catch {
            // ignore
          }
        }
      })
    );

    sessionStorage.setItem(KEY, "1");
  } catch {
    // no-op
  }
}
