/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useState } from "react";

import {
  fetchActiveSessionForUser,
  subscribeActiveSessionForUser,
} from "@/services/timeLogs.js";
import logError from "@/utils/logError.js";

export default function useActiveTimeSession(user) {
  const identity = useMemo(() => {
    const resolvedUid = user?.uid || user?.id || null;
    const resolvedEmail = user?.email || null;
    return {
      uid: resolvedUid,
      email: resolvedEmail,
    };
  }, [user?.email, user?.id, user?.uid]);

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(() =>
    Boolean(identity.uid || identity.email),
  );

  useEffect(() => {
    let isMounted = true;
    let hasRealtimeValue = false;
    let unsubscribe = () => {};

    if (!identity.uid && !identity.email) {
      setSession(null);
      setLoading(false);
      return () => {
        isMounted = false;
        unsubscribe();
      };
    }

    setLoading(true);

    const unsubscribeResult = subscribeActiveSessionForUser({
      uid: identity.uid,
      email: identity.email,
      onData: (data) => {
        hasRealtimeValue = true;
        if (!isMounted) return;
        setSession(data);
        setLoading(false);
      },
      onError: (error) => {
        logError(error, {
          where: "useActiveTimeSession",
          action: "subscribe",
        });
        if (!hasRealtimeValue && isMounted) {
          setLoading(false);
        }
      },
    });
    if (typeof unsubscribeResult === "function") {
      unsubscribe = unsubscribeResult;
    }

    (async () => {
      try {
        const data = await fetchActiveSessionForUser({
          uid: identity.uid,
          email: identity.email,
        });
        if (!isMounted || hasRealtimeValue) return;
        setSession(data);
      } catch (error) {
        logError(error, {
          where: "useActiveTimeSession",
          action: "fetch",
        });
        if (!isMounted || hasRealtimeValue) return;
        setSession(null);
      } finally {
        if (isMounted && !hasRealtimeValue) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [identity.email, identity.uid]);

  return { session, loading };
}
