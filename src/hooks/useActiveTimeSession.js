/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState } from "react";

import { subscribeTimeLogs } from "@/services/fs";
import logError from "@/utils/logError.js";
import { isActiveRow } from "@/utils/time";

export default function useActiveTimeSession(user) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(() =>
    Boolean(user?.uid || user?.id || user?.email),
  );

  useEffect(() => {
    const identities = new Set();
    const addIdentity = (value) => {
      if (!value) return;
      const str = String(value).trim();
      if (!str) return;
      identities.add(str);
      identities.add(str.toLowerCase());
    };

    addIdentity(user?.uid || user?.id);
    addIdentity(user?.email);
    addIdentity(user?.displayName);

    if (identities.size === 0) {
      setSession(null);
      setLoading(false);
      return () => {};
    }

    setLoading(true);

    const driverIds = Array.from(identities).filter(
      (value) => !value.includes("@") || value === value.toLowerCase(),
    );
    const identityLookup = new Set(
      Array.from(identities, (value) => String(value).toLowerCase()),
    );

    const unsubscribe = subscribeTimeLogs({
      driverId: driverIds.length ? driverIds : null,
      limit: 40,
      onData: (rows) => {
        const list = Array.isArray(rows) ? rows : [];
        const match = list.find((row) => {
          if (!row || !isActiveRow(row)) return false;
          const values = [
            row.driverId,
            row.userId,
            row.driver,
            row.driverName,
            row.driverEmail,
            row.userEmail,
          ];
          return values.some((value) => {
            if (value == null) return false;
            const str = String(value).toLowerCase();
            return identityLookup.has(str);
          });
        });
        setSession(match || null);
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
  }, [user?.uid, user?.id, user?.email, user?.displayName]);

  return { session, loading };
}
