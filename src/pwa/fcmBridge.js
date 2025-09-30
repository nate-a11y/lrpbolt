/* Proprietary and confidential. See LICENSE. */

/**
 * Send FIREBASE_CONFIG to the Service Worker so it can lazy-init Firebase Messaging
 * even when the token is already cached. Retries and waits for ACK.
 *
 * @param {{apiKey:string, authDomain?:string, projectId:string, messagingSenderId:string, appId:string, vapidKey?:string}} firebaseConfig
 * @returns {Promise<boolean>} true if SW acknowledged init
 */
export async function ensureFcmSwReady(firebaseConfig) {
  if (!("serviceWorker" in navigator)) return false;
  const payload = { config: firebaseConfig };

  async function postOnce() {
    try {
      if (navigator.serviceWorker.controller) {
        const ch = new MessageChannel();
        const ack = new Promise((resolve) => {
          ch.port1.onmessage = (event) =>
            resolve(event?.data?.type === "FIREBASE_CONFIG_ACK");
        });
        navigator.serviceWorker.controller.postMessage(
          { type: "FIREBASE_CONFIG", payload },
          [ch.port2],
        );
        const ok = await Promise.race([
          ack,
          new Promise((resolve) => setTimeout(() => resolve(false), 1500)),
        ]);
        return Boolean(ok);
      }

      const reg = await navigator.serviceWorker.ready.catch((error) => {
        console.error("[ensureFcmSwReady] ready failed", error);
        return null;
      });
      if (reg?.active) {
        try {
          const ch = new MessageChannel();
          const ack = new Promise((resolve) => {
            ch.port1.onmessage = (event) =>
              resolve(event?.data?.type === "FIREBASE_CONFIG_ACK");
          });
          reg.active.postMessage({ type: "FIREBASE_CONFIG", payload }, [
            ch.port2,
          ]);
          const ok = await Promise.race([
            ack,
            new Promise((resolve) => setTimeout(() => resolve(false), 1500)),
          ]);
          return Boolean(ok);
        } catch (error) {
          console.error("[ensureFcmSwReady] post to active failed", error);
        }
      }
      return false;
    } catch (error) {
      console.error("[ensureFcmSwReady] postOnce failed", error);
      return false;
    }
  }

  for (let i = 0; i < 4; i += 1) {
    const ok = await postOnce();
    if (ok) return true;
    await new Promise((resolve) => setTimeout(resolve, 200 * (i + 1)));
  }
  return false;
}
