/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState } from "react";

import { subscribeActiveSessionForUser } from "@/services/timeLogs.js";
import logError from "@/utils/logError.js";

export default function useActiveTimeSession(user) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(() =>
    Boolean(user?.uid || user?.id || user?.email),
  );

  useEffect(() => {
    const uid = user?.uid || user?.id || null;
    const email = user?.email || null;

    if (!uid && !email) {
      setSession(null);
      setLoading(false);
      return () => {};
    }

    setLoading(true);

    const unsubscribe = subscribeActiveSessionForUser({
      uid,
      email,
      onNext: (nextSession) => {
        setSession(nextSession || null);
        setLoading(false);
      },
      onError: (error) => {
        logError(error, {
          where: "useActiveTimeSession",
          action: "subscribe",
        });
        setSession(null);
        setLoading(false);
      },
    });

    return () => {
      try {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
      } catch (error) {
        logError(error, {
          where: "useActiveTimeSession",
          action: "cleanup",
        });
      }
    };
  }, [user?.uid, user?.id, user?.email]);

  return { session, loading };
}
