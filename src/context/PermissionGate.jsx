/* Proprietary and confidential. See LICENSE. */
import { useEffect } from "react";

import { getFcmTokenSafe } from "@/services/pushTokens";
import { app as firebaseApp } from "@/utils/firebaseInit";
import { diagPushSupport } from "@/utils/pushDiag.js";

export default function PermissionGate({ children }) {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    console.info("[LRP][PushSupport]", diagPushSupport());

    let cancelled = false;
    (async () => {
      try {
        const result = await getFcmTokenSafe(
          firebaseApp,
          import.meta.env.VITE_FIREBASE_VAPID_KEY,
        );
        if (cancelled) return;
        if (result?.ok && result.token) {
          try {
            localStorage.setItem("lrp_fcm_token_v1", result.token);
          } catch (error) {
            console.warn("[PermissionGate] token cache failed", error);
          }
        } else if (result?.reason) {
          console.info("[PermissionGate] push blocked", result.reason);
        }
      } catch (error) {
        console.error("[PermissionGate] FCM init failed", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
  return children ?? null;
}
