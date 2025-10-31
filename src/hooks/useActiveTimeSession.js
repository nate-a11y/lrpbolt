/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useState } from "react";

import { subscribeTimeLogs } from "@/services/fs";
import logError from "@/utils/logError.js";
import { toDayjs } from "@/utils/time";

export default function useActiveTimeSession(user) {
  const initialLoading = Boolean(user?.uid || user?.id || user?.email);
  const [state, setState] = useState(() => ({
    session: null,
    loading: initialLoading,
    hasActive: false,
    hasValidStart: false,
    sessionId: null,
    startField: "(none)",
    startTsType: "undefined",
  }));

  const identityLookup = useMemo(() => {
    const lookup = new Set();
    const append = (value) => {
      if (!value) return;
      const str = String(value).trim();
      if (!str) return;
      lookup.add(str.toLowerCase());
    };
    append(user?.uid || user?.id);
    append(user?.email);
    append(user?.displayName);
    return lookup;
  }, [user?.displayName, user?.email, user?.id, user?.uid]);

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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Clearing session state when no identities
      setState((prev) => ({
        ...prev,
        session: null,
        loading: false,
        hasActive: false,
        hasValidStart: false,
        sessionId: null,
        startField: "(none)",
        startTsType: "undefined",
      }));
      return () => {};
    }

    setState((prev) => ({ ...prev, loading: true }));

    const allKeys = Array.from(identities);

    const unsubscribe = subscribeTimeLogs({
      key: allKeys.length ? allKeys : null,
      limit: 40,
      onData: (rows) => {
        const list = Array.isArray(rows) ? rows : [];
        const filtered = list.filter((row) => {
          if (!row) return false;
          const candidates = [
            row.driverKey,
            row.driverId,
            row.userId,
            row.driverEmail,
            row.userEmail,
            row.logicalId,
          ];
          return candidates.some((value) => {
            if (value == null) return false;
            const str = String(value).trim().toLowerCase();
            return identityLookup.has(str);
          });
        });

        const active = filtered.find((row) => {
          if (!row) return false;
          const start = row.startTs ?? null;
          const end = row.endTs ?? null;
          const status = row.status ?? (end ? "closed" : "open");
          return status !== "closed" && !!start && !end;
        });

        const startValue = active?.startTs ?? null;
        const validStart = startValue ? Boolean(toDayjs(startValue)) : false;

        setState({
          session: active || null,
          loading: false,
          hasActive: Boolean(active),
          hasValidStart: validStart,
          sessionId: active?.id || null,
          startField: active?.startTs ? "startTs" : "(none)",
          startTsType:
            active?.startTs === null || active?.startTs === undefined
              ? String(active?.startTs)
              : typeof active?.startTs,
        });
      },
      onError: (error) => {
        logError(error, {
          where: "useActiveTimeSession",
          action: "subscribe",
        });
        setState({
          session: null,
          loading: false,
          hasActive: false,
          hasValidStart: false,
          sessionId: null,
          startField: "(none)",
          startTsType: "error",
        });
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
  }, [identityLookup, user?.uid, user?.id, user?.email, user?.displayName]);

  return state;
}
