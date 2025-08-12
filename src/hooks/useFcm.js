/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState } from "react";

import { enableFcmForUser, onForegroundMessage } from "../utils/fcm";

export function useFcm(user) {
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        if (!user?.email) return;
        const t = await enableFcmForUser(user);
        setToken(t);
        unsub = onForegroundMessage((payload) => {
          window.dispatchEvent(new CustomEvent("LRP_FCM_MESSAGE", { detail: payload }));
        });
      } catch (e) {
        setError(e);
      }
    })();
    return () => {
      try { unsub?.(); } catch { /* no-op */ }
    };
  }, [user, user?.email]);

  return { token, error };
}
