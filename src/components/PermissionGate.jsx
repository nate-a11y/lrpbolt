/* Proprietary and confidential. See LICENSE. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSupported as isMessagingSupported } from "firebase/messaging";
import { Alert, Snackbar } from "@mui/material";

import { attachForegroundMessagingHandler } from "@/services/pushTokens";
import { ensureServiceWorkerRegistered, getFcmTokenSafe } from "@/services/fcm";
import { claimAnonymousToken, saveUserPushToken } from "@/services/fcmTokens";
import { app as firebaseApp } from "@/utils/firebaseInit";
import { diagPushSupport } from "@/utils/pushDiag.js";
import { useAuth } from "@/context/AuthContext.jsx";
import logError from "@/utils/logError.js";
import { env } from "@/utils/env.js";

export default function PermissionGate({ user: userProp, children = null }) {
  const authContext = useAuth();
  const contextUser = authContext?.user ?? null;
  const authLoading = authContext?.authLoading ?? false;
  const user = userProp ?? contextUser;
  const [foregroundNotice, setForegroundNotice] = useState(null);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState(() => {
    if (typeof Notification === "undefined") return "default";
    return Notification.permission;
  });
  const vapidKey = env.FCM_VAPID_KEY;
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ok = await isMessagingSupported();
        if (!cancelled) {
          setSupported(Boolean(ok));
        }
      } catch (error) {
        logError(error, { where: "PermissionGate", action: "isSupported" });
        if (!cancelled) {
          setSupported(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!supported) return undefined;
    if (typeof Notification === "undefined") return undefined;
    setPermission(Notification.permission);
    if (Notification.permission !== "default") {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await Notification.requestPermission();
        if (!cancelled && response) {
          setPermission(response);
        }
      } catch (error) {
        logError(error, {
          where: "PermissionGate",
          action: "requestPermission",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const registerPushFor = useCallback(
    async (targetUserId) => {
      try {
        if (!supported) {
          console.info(
            "[LRP][FCM] messaging not supported in this environment",
          );
          return;
        }
        if (permission !== "granted") {
          console.info("[LRP][FCM] notification permission", permission);
          return;
        }
        if (!vapidKey) {
          logError(new Error("Missing VITE_FIREBASE_VAPID_KEY"), {
            where: "PermissionGate",
            action: "vapid-check",
          });
          return;
        }
        const swReg = await ensureServiceWorkerRegistered();
        if (!swReg) {
          console.info("[LRP][FCM] registration unavailable");
          return;
        }
        console.info("[LRP][FCM] registration scope", swReg.scope || "(none)");
        const token = await getFcmTokenSafe(swReg);

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
    },
    [permission, supported, vapidKey],
  );

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
    if (!supported) return undefined;
    if (permission !== "granted") return undefined;

    const currentUserId = normalizedUserId || null;
    if (lastUserIdRef.current === currentUserId) {
      return undefined;
    }

    lastUserIdRef.current = currentUserId;
    registerPushFor(currentUserId).catch((error) => {
      logError(error, { where: "PermissionGate", action: "register-effect" });
    });

    return undefined;
  }, [
    normalizedUserId,
    registerPushFor,
    shouldWaitForAuth,
    permission,
    supported,
  ]);

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
