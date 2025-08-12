/* Proprietary and confidential. See LICENSE. */
/* eslint-env serviceworker */
/* global firebase */
/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging-compat.js");

/** MUST match app config exactly (hardcoded by request). */
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
  const { title = "Lake Ride Pros", body = "", icon = "/icons/icon-192.png" } = payload?.notification || {};
  self.registration.showNotification(title, { body, icon });
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});
