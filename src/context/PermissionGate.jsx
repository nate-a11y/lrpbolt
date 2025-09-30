/* Proprietary and confidential. See LICENSE. */
import { useEffect } from "react";

import { getFcmTokenSafe } from "@/services/pushTokens";
import { firebaseConfig } from "@/utils/firebaseInit";

export default function PermissionGate({ children }) {
  useEffect(() => {
    (async () => {
      try {
        if (!("Notification" in window)) return;
        if (Notification.permission === "default") {
          const perm = await Notification.requestPermission();
          if (perm !== "granted") return;
        }
        const firstBindKey = "lrp_fcm_first_bind_done_v1";
        let firstBindDone = false;
        try {
          firstBindDone = localStorage.getItem(firstBindKey) === "1";
        } catch (error) {
          console.warn("[PermissionGate] first bind read failed", error);
        }
        const vapidKey =
          (typeof firebaseConfig?.vapidKey === "string" &&
            firebaseConfig.vapidKey) ||
          (typeof import.meta?.env?.VITE_FIREBASE_VAPID_KEY === "string" &&
            import.meta.env.VITE_FIREBASE_VAPID_KEY) ||
          "";
        const token = await getFcmTokenSafe(firebaseConfig, {
          vapidKey,
          forceRefresh: !firstBindDone,
        });
        if (token && !firstBindDone) {
          try {
            localStorage.setItem(firstBindKey, "1");
          } catch (error) {
            console.warn("[PermissionGate] first bind write failed", error);
          }
        }
      } catch (e) {
        console.error("[PermissionGate] FCM init failed", e);
      }
    })();
  }, []);
  return children ?? null;
}
