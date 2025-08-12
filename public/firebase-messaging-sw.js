/* Proprietary and confidential. See LICENSE. */
/* eslint-env serviceworker */
/* global firebase */
/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging-compat.js");

/**
 * IMPORTANT:
 * Paste the SAME config you use in initializeApp(...) below.
 * TODO: Move to env + injected at build if desired.
 */
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

const messaging = firebase.messaging();

/** Background messages → show a basic notification (customize as needed) */
messaging.onBackgroundMessage((payload) => {
  try {
    const title = (payload?.notification?.title) || "Notification";
    const options = {
      body: payload?.notification?.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      data: payload?.data || {},
    };
    self.registration.showNotification(title, options);
  } catch { /* no-op */ }
});
