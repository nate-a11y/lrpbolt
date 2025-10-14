/* FIX: null-safe elapsed calculation */
import { useEffect, useMemo, useRef, useState } from "react";

import { dayjs, toDayjs } from "@/utils/time";
import { logError } from "@/services/errors";

/**
 * Computes a live-updating elapsed duration since a start timestamp.
 * Limits renders to once per second via rAF (with interval fallback).
 */
export default function useElapsedFromTs(
  startTs,
  { logOnNullOnce = true } = {},
) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const rafRef = useRef(0);
  const didLogRef = useRef(false);

  const startDj = useMemo(() => {
    try {
      return toDayjs(startTs);
    } catch (err) {
      logError(err, { where: "useElapsedFromTs", action: "parse" });
      return null;
    }
  }, [startTs]);

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
    setElapsedSeconds(0);
    return undefined;
  }, [logOnNullOnce, startDj]);

  useEffect(() => {
    if (!startDj) return undefined;

    let active = true;
    let intervalId;
    let lastSecond = -1;

    const updateElapsed = () => {
      const diff = dayjs().diff(startDj, "second");
      const safeDiff = Number.isFinite(diff) && diff > 0 ? diff : 0;
      if (safeDiff !== lastSecond) {
        lastSecond = safeDiff;
        setElapsedSeconds(safeDiff);
      }
    };

    const hasRaf =
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function" &&
      typeof window.cancelAnimationFrame === "function";

    updateElapsed();

    if (hasRaf) {
      const tick = () => {
        if (!active) return;
        updateElapsed();
        rafRef.current = window.requestAnimationFrame(tick);
      };
      rafRef.current = window.requestAnimationFrame(tick);
    } else {
      intervalId = setInterval(() => {
        if (active) updateElapsed();
      }, 1000);
    }

    return () => {
      active = false;
      if (rafRef.current && hasRaf) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [startDj]);

  const elapsedMs = useMemo(() => elapsedSeconds * 1000, [elapsedSeconds]);
  const formatted = useMemo(() => {
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [elapsedSeconds]);
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
