/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useRef, useState } from "react";

import { subscribeRides } from "../services/rideSubscriptions";

/**
 * Idempotent rides hook: subscribes once, cleans up, and pauses on hidden tab.
 */
export function useRides({ vehicleId, status, range, pageSize = 500 }) {
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const unsubRef = useRef(null);
  const visibleRef = useRef(document.visibilityState === "visible");
  const rafRef = useRef(0);

  const updateData = (rows) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setData(rows));
  };

  // Build a stable key so effect runs only when relevant inputs change
  const key = useMemo(() => {
    const s = JSON.stringify({
      vehicleId: vehicleId || "",
      status: status || "",
      range: {
        start: range?.start
          ? new Date(range.start.toDate?.() ?? range.start).toISOString()
          : "",
        end: range?.end
          ? new Date(range.end.toDate?.() ?? range.end).toISOString()
          : "",
      },
      pageSize,
    });
    return s;
  }, [vehicleId, status, range?.start, range?.end, pageSize]);

  useEffect(() => {
    function handleVis() {
      const nowVisible = document.visibilityState === "visible";
      if (!nowVisible && unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
      visibleRef.current = nowVisible;
      if (nowVisible && !unsubRef.current) {
        attach();
      }
    }

    const attach = () => {
      if (unsubRef.current) return;
      const parsed = JSON.parse(key);
      unsubRef.current = subscribeRides(
        {
          vehicleId: parsed.vehicleId,
          status: parsed.status,
          range: {
            start: parsed.range.start ? new Date(parsed.range.start) : undefined,
            end: parsed.range.end ? new Date(parsed.range.end) : undefined,
          },
          pageSize: parsed.pageSize,
        },
        updateData,
        setError
      );
    };

    document.addEventListener("visibilitychange", handleVis);
    return () => {
      document.removeEventListener("visibilitychange", handleVis);
    };
  }, [key]);

  useEffect(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (document.visibilityState !== "visible") return;

    const parsed = JSON.parse(key);
    unsubRef.current = subscribeRides(
      {
        vehicleId: parsed.vehicleId,
        status: parsed.status,
        range: {
          start: parsed.range.start ? new Date(parsed.range.start) : undefined,
          end: parsed.range.end ? new Date(parsed.range.end) : undefined,
        },
        pageSize: parsed.pageSize,
      },
      updateData,
      setError
    );

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [key]);

  return { rides: data, error };
}
