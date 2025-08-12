/* Proprietary and confidential. See LICENSE. */
/* Firebase app bootstrap (single init, modular SDK) */
import { initializeApp, getApps } from "firebase/app";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported as messagingSupported } from "firebase/messaging";

/** IMPORTANT: hardcoded on purpose per request (move to env later). */
const firebaseConfig = {
  apiKey: "AIzaSyDziITaFCf1_8tb2iSExBC7FDGDOmWaGns",
  authDomain: "lrp---claim-portal.firebaseapp.com",
  projectId: "lrp---claim-portal",
  storageBucket: "lrp---claim-portal.firebasestorage.app",
  messagingSenderId: "799613895072",
  appId: "1:799613895072:web:1b41c28c6819198ce824c5",
  measurementId: "G-9NM69MZN6B",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

/** Lazy, safe feature gates (no throw on unsupported). */
let analytics;
(async () => {
  try {
    if (await analyticsSupported()) analytics = getAnalytics(app);
  } catch {
    /* no-op */
  }
})();

let messaging;
(async () => {
  try {
    if (await messagingSupported()) messaging = getMessaging(app);
  } catch {
    /* no-op */
  }
})();

export { app, auth, db, messaging, analytics, firebaseConfig };
