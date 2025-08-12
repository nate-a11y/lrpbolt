/* Proprietary and confidential. See LICENSE. */
import { getFunctions, httpsCallable } from "firebase/functions";

import { app } from "src/utils/firebaseInit";

const fn = httpsCallable(getFunctions(app), "sendPortalNotification");

/** Sends a portal notification.
 * opts: { email?: string, token?: string, topic?: string, title: string, body?: string, icon?: string, data?: Record<string,string> }
 * Returns { ok: true, count: number }
 */
export async function sendPortalNotification(opts) {
  const res = await fn(opts);
  return res?.data || res;
}
