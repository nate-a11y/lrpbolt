/* Proprietary and confidential. See LICENSE. */
/* global importScripts, firebase */

importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging-compat.js");

/** 🔒 Paste the SAME config you use in initializeApp(...) */
firebase.initializeApp({
  apiKey: "AIzaSyDziITaFCf1_8tb2iSExBC7FDGDOmWaGns",
  authDomain: "lrp---claim-portal.firebaseapp.com",
  projectId: "lrp---claim-portal",
  storageBucket: "lrp---claim-portal.firebasestorage.app",
  messagingSenderId: "799613895072",
  appId: "1:799613895072:web:1b41c28c6819198ce824c5",
  measurementId: "G-9NM69MZN6B",
});

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
