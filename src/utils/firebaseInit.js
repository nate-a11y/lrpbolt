/* Proprietary and confidential. See LICENSE. */
import { initializeApp, getApps } from "firebase/app";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported as messagingSupported } from "firebase/messaging";

/** HARD-CODED PER REQUEST (move to env later). */
export const firebaseConfig = {
  apiKey: "AIzaSyDziITaFCf1_8tb2iSExBC7FDGDOmWaGns",
  authDomain: "lrp---claim-portal.firebaseapp.com",
  projectId: "lrp---claim-portal",
  storageBucket: "lrp---claim-portal.firebasestorage.app",
  messagingSenderId: "799613895072",
  appId: "1:799613895072:web:1b41c28c6819198ce824c5",
  measurementId: "G-9NM69MZN6B",
};

export const app = getApps()[0] || initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export let analytics;
(async () => { try { if (await analyticsSupported()) analytics = getAnalytics(app); } catch { /* ignore */ } })();

export let messaging;
(async () => { try { if (await messagingSupported()) messaging = getMessaging(app); } catch { /* ignore */ } })();
