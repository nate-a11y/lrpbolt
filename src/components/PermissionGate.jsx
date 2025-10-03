/* Proprietary and confidential. See LICENSE. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Snackbar } from "@mui/material";

import {
  attachForegroundMessagingHandler,
  getFcmTokenSafe,
} from "@/services/pushTokens";
import { claimAnonymousToken, saveUserPushToken } from "@/services/fcmTokens";
import {
  app as firebaseApp,
  getControllingServiceWorkerRegistration,
  getMessagingOrNull,
} from "@/utils/firebaseInit";
import { diagPushSupport } from "@/utils/pushDiag.js";
import { useAuth } from "@/context/AuthContext.jsx";
import logError from "@/utils/logError.js";

export default function PermissionGate({ user: userProp, children = null }) {
  const authContext = useAuth();
  const contextUser = authContext?.user ?? null;
  const authLoading = authContext?.authLoading ?? false;
  const user = userProp ?? contextUser;
  const [foregroundNotice, setForegroundNotice] = useState(null);
  const detachRef = useRef(null);
  const lastUserIdRef = useRef(undefined);
  const lastPersistedRef = useRef({ userId: undefined, token: undefined });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    console.info("[LRP][PushSupport]", diagPushSupport());
    return undefined;
  }, []);

  const handleForegroundPayload = useCallback((payload) => {
    const notification = payload?.notification || payload?.data || {};
    const title = notification?.title || payload?.title || "Notification";
    const body = notification?.body || payload?.body || "";
    setForegroundNotice({ title, body, receivedAt: Date.now() });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (!detachRef.current) {
      detachRef.current = attachForegroundMessagingHandler(
        firebaseApp,
        handleForegroundPayload,
      );
    }
    return () => {
      if (detachRef.current) {
        detachRef.current();
        detachRef.current = null;
      }
    };
  }, [handleForegroundPayload]);

  const registerPushFor = useCallback(async (targetUserId) => {
    try {
      const swReg = await getControllingServiceWorkerRegistration();
      console.info("[LRP][FCM] registration scope", swReg?.scope || "(none)");
      const messaging = await getMessagingOrNull();
      if (!messaging) {
        console.warn("[LRP][FCM] messaging unavailable in PermissionGate");
        return;
      }

      const token = await getFcmTokenSafe({
        messaging,
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: swReg || undefined,
      });

      if (!token) {
        console.warn("[LRP][FCM] registration did not issue a token");
        return;
      }
      const resolvedUserId = targetUserId ?? "anonymous";
      const { userId: lastUserId, token: lastToken } =
        lastPersistedRef.current || {};

      if (lastUserId === resolvedUserId && lastToken === token) {
        return;
      }

      try {
        localStorage.setItem("lrp_fcm_token_v1", token);
      } catch (storageError) {
        logError(storageError, {
          where: "PermissionGate",
          action: "cache-token",
        });
      }

      if (resolvedUserId !== "anonymous") {
        await claimAnonymousToken({ token, userId: resolvedUserId });
      }

      await saveUserPushToken({
        userId: resolvedUserId,
        token,
        deviceInfo: { ua: navigator.userAgent, scope: swReg?.scope || null },
      });

      lastPersistedRef.current = { userId: resolvedUserId, token };
      console.info("[LRP][FCM] token persisted for", resolvedUserId);
    } catch (error) {
      logError(error, { where: "PermissionGate", action: "registerPushFor" });
    }
  }, []);

  const normalizedUserId = (() => {
    if (!user) return null;
    const raw = user.uid || user.id || user.email || null;
    if (!raw) return null;
    return String(raw).trim();
  })();

  const shouldWaitForAuth = userProp === undefined && authLoading;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (shouldWaitForAuth) return undefined;

    const currentUserId = normalizedUserId || null;
    if (lastUserIdRef.current === currentUserId) {
      return undefined;
    }

    lastUserIdRef.current = currentUserId;
    registerPushFor(currentUserId).catch((error) => {
      logError(error, { where: "PermissionGate", action: "register-effect" });
    });

    return undefined;
  }, [normalizedUserId, registerPushFor, shouldWaitForAuth]);

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
      {children}
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
