/* Proprietary and confidential. See LICENSE. */
export async function ensureFcmSwReady(firebaseConfig) {
  if (!("serviceWorker" in navigator)) return false;
  const payload = { config: firebaseConfig };
  async function postOnce() {
    try {
      const target =
        navigator.serviceWorker.controller ||
        (await navigator.serviceWorker.ready.catch(() => null))?.active;
      if (!target) return false;
      const ch = new MessageChannel();
      const ack = new Promise((resolve) => {
        ch.port1.onmessage = (e) =>
          resolve(e?.data?.type === "FIREBASE_CONFIG_ACK");
      });
      target.postMessage({ type: "FIREBASE_CONFIG", payload }, [ch.port2]);
      const ok = await Promise.race([
        ack,
        new Promise((r) => setTimeout(() => r(false), 1500)),
      ]);
      return Boolean(ok);
    } catch (e) {
      console.error("[ensureFcmSwReady] post failed", e);
      return false;
    }
  }
  for (let i = 0; i < 4; i += 1) {
    const ok = await postOnce();
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 200 * (i + 1)));
  }
  return false;
}
