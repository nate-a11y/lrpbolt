/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState } from "react";

import { notificationsSupported, getPermission } from "../utils/fcm";

export default function useNotificationPermission() {
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState(getPermission());

  useEffect(() => {
    (async () => setSupported(await notificationsSupported()))();
    const onVis = () => setPermission(getPermission());
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return { supported, permission };
}
