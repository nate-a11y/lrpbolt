/* Proprietary and confidential. See LICENSE. */
function _post(target, type, payload) {
  try {
    target.postMessage({ type, payload });
    return true;
  } catch (e) {
    console.error("[clockNotifications] post fail", e);
    return false;
  }
}
async function postToSW(type, payload) {
  if (!("serviceWorker" in navigator)) return false;
  try {
    if (navigator.serviceWorker.controller)
      return _post(navigator.serviceWorker.controller, type, payload);
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (reg?.active) return _post(reg.active, type, payload);
    return false;
  } catch (e) {
    console.error("[clockNotifications] postToSW failed", e);
    return false;
  }
}
async function postWithRetry(type, payload, attempts = 4) {
  for (let i = 0; i < attempts; i += 1) {
    const ok = await postToSW(type, payload);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 200 * (i + 1)));
  }
  return false;
}

export async function requestPersistentClockNotification(text) {
  try {
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;
    const ok = await postWithRetry("SHOW_CLOCK_FROM_SW", {
      title: "LRP — On the clock",
      body: text || "",
    });
    if (!ok) {
      try {
        new Notification("LRP — On the clock", { body: text || "" });
      } catch (error) {
        console.warn("[clockNotifications] direct notification failed", error);
      }
    }
  } catch (e) {
    console.error("[clockNotifications] request failed", e);
  }
}
export async function stopPersistentClockNotification() {
  try {
    await postWithRetry("STOP_CLOCK_STICKY");
  } catch (e) {
    console.error(e);
  }
}
export async function clearClockNotification() {
  try {
    await postWithRetry("CLEAR_CLOCK_FROM_SW");
  } catch (e) {
    console.error(e);
  }
}

export async function diagShowSwNotification(body = "SW diagnostic") {
  await postWithRetry("DIAG_NOTIFY", { body });
}
