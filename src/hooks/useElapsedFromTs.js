/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useRef, useState } from "react";

import { toDayjs } from "@/utils/time.js";
import logError from "@/utils/logError.js";

const MIN_TICK_INTERVAL = 250;

function normalizeTickMs(tickMs) {
  const numeric = Number(tickMs);
  if (!Number.isFinite(numeric) || numeric <= 0) return 1000;
  return Math.max(MIN_TICK_INTERVAL, Math.floor(numeric));
}

function formatElapsed(elapsedMs) {
  const safeMs = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Computes a live-updating elapsed duration since a start timestamp.
 * Guards invalid inputs and never surfaces negative durations.
 */
export default function useElapsedFromTs(
  startTs,
  { logOnNullOnce = true, tickMs = 1000 } = {},
) {
  const logOnceRef = useRef(false);
  const start = useMemo(() => {
    const parsed = toDayjs(startTs);
    if (parsed) {
      logOnceRef.current = false;
      return parsed;
    }
    if (startTs != null && logOnNullOnce && !logOnceRef.current) {
      logError(new Error("Invalid start timestamp"), {
        where: "useElapsedFromTs",
        action: "parse",
      });
      logOnceRef.current = true;
    }
    return null;
  }, [startTs, logOnNullOnce]);

  const startMs = start?.valueOf() ?? null;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!startMs) {
      setNowMs(Date.now());
      return undefined;
    }
    if (typeof window === "undefined") return undefined;

    let rafId = 0;
    let intervalId = 0;
    const normalizedTickMs = normalizeTickMs(tickMs);
    const updateNow = (force = false) => {
      const now = Date.now();
      setNowMs((prev) => {
        if (!force) {
          const prevBucket = Number.isFinite(prev)
            ? Math.floor(prev / normalizedTickMs)
            : -1;
          const nextBucket = Math.floor(now / normalizedTickMs);
          if (prevBucket === nextBucket) {
            return prev;
          }
        }
        return now;
      });
    };
    updateNow(true);

    const hasRaf =
      typeof window.requestAnimationFrame === "function" &&
      typeof window.cancelAnimationFrame === "function";

    if (hasRaf) {
      const tick = () => {
        updateNow();
        rafId = window.requestAnimationFrame(tick);
      };
      rafId = window.requestAnimationFrame(tick);
    } else {
      intervalId = window.setInterval(updateNow, normalizedTickMs);
    }

    return () => {
      if (rafId && hasRaf) {
        window.cancelAnimationFrame(rafId);
      }
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [startMs, tickMs]);

  const elapsedMs = useMemo(() => {
    if (!startMs) return null;
    const diff = nowMs - startMs;
    return diff >= 0 ? diff : 0;
  }, [nowMs, startMs]);

  const formatted = useMemo(() => formatElapsed(elapsedMs ?? 0), [elapsedMs]);

  if (!startMs || !start) {
    return {
      status: "missingStart",
      start: null,
      startMs: null,
      elapsedMs: 0,
      formatted,
    };
  }

  return {
    status: "ok",
    start,
    startMs,
    elapsedMs: elapsedMs ?? 0,
    formatted,
  };
}
