import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

// Explicit region to match server
const app = getApp();
export const functions = getFunctions(app, "us-central1");

export async function callDropDailyRidesNow(payload = {}) {
  const fn = httpsCallable(functions, "dropDailyRidesNow");
  const res = await fn(payload);
  return res.data;
}
