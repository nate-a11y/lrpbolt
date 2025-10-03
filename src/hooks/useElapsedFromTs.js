/* FIX: null-safe elapsed calculation */
import { useEffect, useMemo, useRef, useState } from "react";

import { dayjs, formatDuration, toDayjs } from "@/utils/time";
import { logError } from "@/services/errors";

/**
 * Computes a live-updating elapsed duration since a start timestamp.
 */
export default function useElapsedFromTs(
  startTs,
  { tickMs = 1000, logOnNullOnce = true } = {},
) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const timeoutRef = useRef();
  const didLogRef = useRef(false);

  const startDj = useMemo(() => {
    try {
      return toDayjs(startTs);
    } catch (err) {
      logError(err, { where: "useElapsedFromTs", action: "parse" });
      return null;
    }
  }, [startTs]);

  const safeTickMs = useMemo(() => {
    return Number.isFinite(tickMs) && tickMs > 0 ? tickMs : 1000;
  }, [tickMs]);

  useEffect(() => {
    if (startDj) {
      didLogRef.current = false;
      return undefined;
    }
    if (!logOnNullOnce || !didLogRef.current) {
      logError(
        { message: "Invalid or missing startTs" },
        { where: "useElapsedFromTs", action: "parse" },
      );
      if (logOnNullOnce) {
        didLogRef.current = true;
      }
    }
    setElapsedMs(0);
    return undefined;
  }, [logOnNullOnce, startDj]);

  useEffect(() => {
    if (!startDj) return undefined;

    const tick = () => {
      const now = dayjs();
      const diff = now.diff(startDj);
      setElapsedMs(Number.isFinite(diff) && diff > 0 ? diff : 0);
      timeoutRef.current = setTimeout(tick, safeTickMs);
    };

    tick();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    };
  }, [safeTickMs, startDj]);

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    },
    [],
  );

  const formatted = useMemo(() => formatDuration(elapsedMs), [elapsedMs]);
  const startMs = startDj?.valueOf();

  if (!startDj) {
    return {
      status: "missingStart",
      start: undefined,
      startMs: undefined,
      elapsedMs: 0,
      formatted,
    };
  }

  return {
    status: "ok",
    start: startDj,
    startMs,
    elapsedMs,
    formatted,
  };
}
