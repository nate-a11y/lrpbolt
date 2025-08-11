import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

const app = getApp();
const functions = getFunctions(app, "us-central1"); // region pinned

export async function callDropDailyRidesNow(payload = {}) {
  const fn = httpsCallable(functions, "dropDailyRidesNow");
  const res = await fn(payload);
  return res.data; // { ok, at }
}
