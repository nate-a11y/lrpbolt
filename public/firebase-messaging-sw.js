/* Proprietary and confidential. See LICENSE. */
/* global importScripts, firebase */

importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging-compat.js");

// Allow the page to pass config; initialize once.
let __inited = false;
function initIfNeeded(cfg) {
  if (__inited) return;
  try {
    firebase.initializeApp(cfg || {});
    __inited = true;
  } catch {
    // ignore duplicate init
    __inited = true;
  }
}

// Receive config from page (posted after registration)
self.addEventListener("message", (evt) => {
  const cfg = evt?.data?.__FIREBASE_CONFIG;
  if (cfg) initIfNeeded(cfg);
});

// Fallback (some browsers won't postMessage before push arrives)
initIfNeeded(self.__FIREBASE_CONFIG);

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || "Notification";
  const options = {
    body: payload?.notification?.body || "",
    icon: payload?.notification?.icon || "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    data: payload?.data || {},
  };
  self.registration.showNotification(title, options);
});
