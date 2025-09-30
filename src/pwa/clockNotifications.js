/* Proprietary and confidential. See LICENSE. */

async function postToSW(type, payload) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
    return false;
  try {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type, payload });
      return true;
    }
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (reg?.active) {
      reg.active.postMessage({ type, payload });
      return true;
    }
    return false;
  } catch (e) {
    console.error("[clockNotifications] postToSW failed", e);
    return false;
  }
}

async function postToSWWithRetry(type, payload, attempts = 3) {
  for (let i = 0; i < attempts; i += 1) {
    const ok = await postToSW(type, payload);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 150 * (i + 1)));
  }
  return false;
}

export async function requestPersistentClockNotification(text, options = {}) {
  try {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission !== "granted"
    ) {
      return;
    }
    await postToSWWithRetry("SHOW_CLOCK_FROM_SW", {
      title: "LRP — On the clock",
      body: text || "",
      options: options && typeof options === "object" ? options : {},
    });
  } catch (e) {
    console.error(
      "[clockNotifications] requestPersistentClockNotification failed",
      e,
    );
  }
}

export async function stopPersistentClockNotification() {
  try {
    await postToSWWithRetry("STOP_CLOCK_STICKY");
  } catch (e) {
    console.error(
      "[clockNotifications] stopPersistentClockNotification failed",
      e,
    );
  }
}

export async function clearClockNotification() {
  try {
    await postToSWWithRetry("CLEAR_CLOCK_FROM_SW");
  } catch (e) {
    console.error("[clockNotifications] clearClockNotification failed", e);
  }
}
