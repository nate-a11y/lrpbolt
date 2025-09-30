/* Proprietary and confidential. See LICENSE. */
async function postToSW(type, payload) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }
  try {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type, payload });
      return true;
    }
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    if (registration?.active) {
      registration.active.postMessage({ type, payload });
      return true;
    }
    return false;
  } catch (error) {
    console.error("[clockNotifications] postToSW failed", error);
    return false;
  }
}

async function postToSWWithRetry(type, payload, attempts = 4) {
  for (let i = 0; i < attempts; i += 1) {
    const ok = await postToSW(type, payload);
    if (ok) return true;
    await new Promise((resolve) => setTimeout(resolve, 150 * (i + 1)));
  }
  return false;
}

export async function requestPersistentClockNotification(text) {
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
    });
  } catch (error) {
    console.error("[clockNotifications] request failed", error);
  }
}

export async function stopPersistentClockNotification() {
  try {
    await postToSWWithRetry("STOP_CLOCK_STICKY");
  } catch (error) {
    console.error("[clockNotifications] stop failed", error);
  }
}

export async function clearClockNotification() {
  try {
    await postToSWWithRetry("CLEAR_CLOCK_FROM_SW");
  } catch (error) {
    console.error("[clockNotifications] clear failed", error);
  }
}
