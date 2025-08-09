import { getApps, initializeApp, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = getApps().length ? getApp() : initializeApp();

export const db = getFirestore(app);
