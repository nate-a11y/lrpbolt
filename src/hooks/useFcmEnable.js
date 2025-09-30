import { useCallback, useEffect, useState } from "react";

import {
  isSupportedBrowser,
  ensureServiceWorkerRegistered,
  requestFcmPermission,
  getFcmTokenSafe,
} from "../services/fcm";
import logError from "../utils/logError.js";

const FCM_ENABLED = import.meta.env.VITE_ENABLE_FCM === "true";

export default function useFcmEnable() {
  const supported = isSupportedBrowser();
  const [permission, setPermission] = useState(() =>
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );
  const readToken = useCallback(() => {
    try {
      return (
        localStorage.getItem("lrp_fcm_token_v1") ||
        localStorage.getItem("lrp_fcm_token") ||
        null
      );
    } catch (error) {
      logError(error, { where: "fcm", action: "read-token" });
      return null;
    }
  }, []);

  const [token, setToken] = useState(() => readToken());

  useEffect(() => {
    if (!FCM_ENABLED || !supported) return;
    setPermission(
      typeof Notification !== "undefined" ? Notification.permission : "denied",
    );
    setToken(readToken());
  }, [readToken, supported]);

  const enableFcm = useCallback(async () => {
    if (!FCM_ENABLED || !supported) return null;
    try {
      const reg = await ensureServiceWorkerRegistered();
      if (!reg) return null;
      const perm = await requestFcmPermission();
      setPermission(perm);
      if (perm !== "granted") return null;
      const t = await getFcmTokenSafe();
      if (t) setToken(t);
      return t;
    } catch (err) {
      logError(err, { where: "fcm", action: "enable" });
      return null;
    }
  }, [supported]);

  return { supported, permission, token, enableFcm };
}
