/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useRef, useState } from "react";

import { dayjs, formatDuration, toDayjs } from "@/utils/time";
import logError from "@/utils/logError.js";

/**
 * Computes a live-updating elapsed duration since a start timestamp.
 */
export default function useElapsedFromTs(startTs, { tickMs = 1000 } = {}) {
  const startDj = useMemo(() => toDayjs(startTs), [startTs]);
  const safeTickMs = useMemo(
    () => (Number.isFinite(tickMs) && tickMs > 0 ? tickMs : 1000),
    [tickMs],
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const timeoutRef = useRef();

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
    if (startDj) return undefined;
    logError(new Error("Invalid or missing startTs"), {
      where: "useElapsedFromTs",
      action: "parse",
    });
    return undefined;
  }, [startDj]);

  const diff = startDj ? dayjs(nowMs).diff(startDj) : 0;
  const elapsedMs = Number.isFinite(diff) && diff > 0 ? diff : 0;

  return {
    elapsedMs,
    formatted: formatDuration(elapsedMs),
  };
}
