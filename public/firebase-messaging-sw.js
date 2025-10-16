/* eslint-disable no-undef */
// Minimal SW for Firebase Messaging compat (receives background messages).
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js");

// Page code initializes the app; in the SW we only need messaging.
try {
  if (!firebase.apps || firebase.apps.length === 0) {
    firebase.initializeApp({
      messagingSenderId: "799613895072",
    });
  }
  firebase.messaging();
  // Optional: background display logic goes here if needed.
} catch (err) {
  // Keep quiet in SW to avoid console noise while still touching the error.
  void err;
}
