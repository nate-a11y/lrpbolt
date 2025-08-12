/* Proprietary and confidential. See LICENSE. */
/* global importScripts, firebase */

try {
  importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging-compat.js");

  // MUST MATCH your web app config exactly
  firebase.initializeApp({
    apiKey: "AIzaSyDziITaFCf1_8tb2iSExBC7FDGDOmWaGns",
    authDomain: "lrp---claim-portal.firebaseapp.com",
    projectId: "lrp---claim-portal",
    storageBucket: "lrp---claim-portal.firebasestorage.app",
    messagingSenderId: "799613895072",
    appId: "1:799613895072:web:1b41c28c6819198ce824c5",
    measurementId: "G-9NM69MZN6B",
  });

  const supported = firebase.messaging && firebase.messaging.isSupported && firebase.messaging.isSupported();

  if (supported) {
    const messaging = firebase.messaging();

    // Background push -> OS notification
    messaging.onBackgroundMessage((payload) => {
      const notif = payload?.notification || {};
      const title = notif.title || "LRP";
      const options = {
        body: notif.body || "",
        icon: notif.icon || "/icons/icon-192.png",
        badge: "/icons/badge-72.png",
        data: payload?.data || {},
      };
      self.registration.showNotification(title, options);
    });
  } else {
    console.warn("[LRP] FCM not supported in this SW environment.");
  }

  // Focus/open app on click
  self.addEventListener("notificationclick", (event) => {
    try {
      event.notification.close();
      event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
          const existing = clientsArr.find((c) => c.url.startsWith(self.location.origin));
          return existing ? existing.focus() : self.clients.openWindow("/");
        }),
      );
    } catch (err) {
      console.error("[LRP] notificationclick error:", err);
    }
  });
} catch (err) {
  console.error("[LRP] SW bootstrap error:", err);
}
