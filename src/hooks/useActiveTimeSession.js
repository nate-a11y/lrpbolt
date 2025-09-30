/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useState } from "react";

import { fetchActiveSessionForUser } from "@/services/timeLogs.js";
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

    if (!identity.uid && !identity.email) {
      setSession(null);
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setLoading(true);
    (async () => {
      try {
        const data = await fetchActiveSessionForUser({
          uid: identity.uid,
          email: identity.email,
        });
        if (!isMounted) return;
        setSession(data);
      } catch (error) {
        logError(error, {
          where: "useActiveTimeSession",
          action: "fetch",
        });
        if (!isMounted) return;
        setSession(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [identity.email, identity.uid]);

  return { session, loading };
}
