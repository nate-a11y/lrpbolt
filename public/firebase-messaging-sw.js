/* Proprietary and confidential. See LICENSE. */
/* eslint-env serviceworker */
/* global importScripts, firebase */

importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging-compat.js");

// MUST MATCH web app config exactly (left hardcoded per request)
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

// Optional: show a simple notification if push arrives in background
messaging.onBackgroundMessage((payload) => {
  const title = (payload?.notification && (payload.notification.title || "LRP")) || "LRP";
  const body = payload?.notification?.body || "New message";
  const icon = payload?.notification?.icon || "/icons/icon-192.png";
  self.registration.showNotification(title, { body, icon });
});
