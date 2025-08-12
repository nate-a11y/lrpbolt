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
firebase.initializeApp({
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
  measurementId: "REPLACE_ME"
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
