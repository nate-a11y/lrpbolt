/* Proprietary and confidential. See LICENSE. */
import { doc, getDoc } from "firebase/firestore";

import { db } from "../utils/firebaseInit";

/**
 * Firestore config doc: config/sms
 * {
 *   mode: "test" | "prod",
 *   testTo: "+18777804236",            // Twilio Virtual Phone (test)
 *   defaultTo: "+15555551234",         // Prod fallback if vehicle not mapped
 *   vehicleMap: { "02": "+15555550102", "03": "+15555550103" } // optional
 * }
 */
let cache;
export async function getSmsConfig() {
  if (cache) return cache;
  const snap = await getDoc(doc(db, "config", "sms"));
  cache = snap.exists() ? snap.data() : {};
  return cache;
}

export async function resolveSmsTo({ vehicleNumber }) {
  const cfg = await getSmsConfig();
  const mode = cfg.mode || (import.meta.env.VITE_SMS_MODE || "test");
  if (mode === "test") {
    return import.meta.env.VITE_SMS_TEST_TO || cfg.testTo; // prefer build var, else Firestore
  }
  // prod
  if (cfg.vehicleMap && vehicleNumber && cfg.vehicleMap[vehicleNumber]) {
    return cfg.vehicleMap[vehicleNumber];
  }
  return cfg.defaultTo; // final fallback
}

