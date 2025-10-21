/* Proprietary and confidential. See LICENSE. */
function joinBase(a, b) {
  const base = String(a || "/");
  const path = String(b || "");
  const normBase = base.endsWith("/") ? base : base + "/";
  const normPath = path.startsWith("/") ? path.slice(1) : path;
  return normBase + normPath;
}

/** Registers the SW under BASE_URL scope and forces control within one navigation. */
export async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const base = import.meta?.env?.BASE_URL || "/";
    const swUrl = joinBase(base, "sw.js");
    const scope = base;
    const reg = await navigator.serviceWorker.register(swUrl, { scope });
    try {
      await reg.update();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.debug("[registerSW] update skipped", error);
    }
    if (!navigator.serviceWorker.controller) {
      setTimeout(() => {
        if (!navigator.serviceWorker.controller) location.reload();
      }, 150);
    }
    return reg;
  } catch (e) {
    console.error("[registerSW] failed", e);
    return null;
  }
}
