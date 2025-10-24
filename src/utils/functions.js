// src/utils/functions.js
import { getApps, getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

/** Lazily get a region‑pinned Functions instance. */
let _functions;
/** Use this in modules that need a live instance at call time (SSR/CI safety). */
export function getLRPFunctions() {
  if (_functions) return _functions;
  // Ensure the Firebase app is already initialized in your bootstrap code.
  const app = getApps().length ? getApp() : null;
  if (!app)
    throw new Error("Firebase app not initialized before getLRPFunctions()");
  _functions = getFunctions(app, "us-central1");
  return _functions;
}

/** Named export for modules that just import { functions } */
export const functions = getLRPFunctions();

/** Callable wrapper(s) */
export async function callDropDailyRidesNow(payload = {}) {
  const fn = httpsCallable(getLRPFunctions(), "dropDailyRidesNow");
  const res = await fn(payload);
  return res.data; // { ok, dryRun, stats }
}

export async function callDeleteUser(email) {
  const fn = httpsCallable(getLRPFunctions(), "deleteUser");
  const res = await fn({ email });
  return res.data; // { success, email, deletedAuth, message }
}
