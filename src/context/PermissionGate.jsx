/* Proprietary and confidential. See LICENSE. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Snackbar } from "@mui/material";

import {
  attachForegroundMessagingHandler,
  getFcmTokenSafe,
} from "@/services/pushTokens";
import { saveUserPushToken } from "@/services/fcmTokens";
import {
  app as firebaseApp,
  getControllingServiceWorkerRegistration,
} from "@/utils/firebaseInit";
import { diagPushSupport } from "@/utils/pushDiag.js";
import { useAuth } from "@/context/AuthContext.jsx";
import logError from "@/utils/logError.js";

export default function PermissionGate({ children }) {
  const { user } = useAuth();
  const [foregroundNotice, setForegroundNotice] = useState(null);

  const handleForegroundPayload = useCallback((payload) => {
    const notification = payload?.notification || payload?.data || {};
    const title = notification?.title || payload?.title || "Notification";
    const body = notification?.body || payload?.body || "";
    setForegroundNotice({ title, body, receivedAt: Date.now() });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    console.info("[LRP][PushSupport]", diagPushSupport());

    const detach = attachForegroundMessagingHandler(
      firebaseApp,
      handleForegroundPayload,
    );
    return () => detach?.();
  }, [handleForegroundPayload]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let cancelled = false;
    (async () => {
      try {
        const swReg = await getControllingServiceWorkerRegistration();
        console.info("[LRP][FCM] registration scope", swReg?.scope || "(none)");
        const result = await getFcmTokenSafe(
          firebaseApp,
          import.meta.env.VITE_FIREBASE_VAPID_KEY,
          swReg,
        );
        if (cancelled) return;
        if (result?.ok && result.token) {
          try {
            localStorage.setItem("lrp_fcm_token_v1", result.token);
          } catch (error) {
            logError(error, { where: "PermissionGate", action: "cache-token" });
          }
          if (cancelled) return;
          try {
            const userId = user?.uid || user?.id || "anonymous";
            await saveUserPushToken({
              userId,
              token: result.token,
              deviceInfo: {
                ua: navigator.userAgent,
                scope: swReg?.scope || null,
              },
            });
            if (cancelled) return;
            console.info("[LRP][FCM] token persisted for", userId);
          } catch (error) {
            logError(error, {
              where: "PermissionGate",
              action: "persist-token",
            });
          }
        } else if (result?.reason) {
          console.warn("[LRP][FCM] push blocked", result.reason);
        }
      } catch (error) {
        logError(error, { where: "PermissionGate", action: "register-push" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const snackbarContent = useMemo(() => {
    if (!foregroundNotice) return null;
    return {
      title: foregroundNotice.title || "Notification",
      body: foregroundNotice.body || "",
    };
  }, [foregroundNotice]);
  const snackbarOpen = Boolean(snackbarContent);

  const handleSnackbarClose = useCallback((_, reason) => {
    if (reason === "clickaway") return;
    setForegroundNotice(null);
  }, []);

  return (
    <>
      {children ?? null}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={5000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity="info"
          variant="filled"
          sx={{ width: "100%", alignItems: "flex-start" }}
        >
          <strong>{snackbarContent?.title}</strong>
          {snackbarContent?.body ? ` — ${snackbarContent.body}` : ""}
        </Alert>
      </Snackbar>
    </>
  );
}
