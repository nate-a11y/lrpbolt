/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useRef, useState } from "react";

import { dayjs, formatDuration, toDayjs } from "@/utils/time";
import logError from "@/utils/logError.js";

/**
 * Computes a live-updating elapsed duration since a start timestamp.
 */
export default function useElapsedFromTs(
  startTs,
  { tickMs = 1000, logOnNullOnce = true } = {},
) {
  const startDj = useMemo(() => toDayjs(startTs), [startTs]);
  const safeTickMs = useMemo(
    () => (Number.isFinite(tickMs) && tickMs > 0 ? tickMs : 1000),
    [tickMs],
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const timeoutRef = useRef();
  const didLogRef = useRef(false);

  useEffect(() => {
    if (!startDj) return undefined;

    function tick() {
      setNowMs(Date.now());
      timeoutRef.current = setTimeout(tick, safeTickMs);
    }

    timeoutRef.current = setTimeout(tick, safeTickMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    };
  }, [safeTickMs, startDj]);

  useEffect(() => {
    if (startDj) {
      didLogRef.current = false;
      return undefined;
    }

    if (!logOnNullOnce || !didLogRef.current) {
      logError(new Error("Invalid or missing startTs"), {
        where: "useElapsedFromTs",
        action: "parse",
      });
      if (logOnNullOnce) {
        didLogRef.current = true;
      }
    }

    return undefined;
  }, [logOnNullOnce, startDj]);

  const startMs = startDj?.valueOf();
  const diff = startDj ? dayjs(nowMs).diff(startDj) : 0;
  const elapsedMs = Number.isFinite(diff) && diff > 0 ? diff : 0;
  const formatted = formatDuration(elapsedMs);

  if (!startDj) {
    return {
      status: "missingStart",
      start: undefined,
      startMs: undefined,
      elapsedMs,
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
