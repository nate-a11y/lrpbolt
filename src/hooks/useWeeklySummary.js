import { useEffect, useState } from "react";

import { dayjs } from "@/utils/time";

import { enrichDriverNames } from "../services/normalizers";
import logError from "../utils/logError.js";

import { subscribeTimeLogs } from "./firestore";

const inWeek = (d, startOfWeek) => {
  if (!d) return false;
  const day = dayjs(d);
  const start = dayjs(startOfWeek).startOf("week");
  const end = start.add(1, "week");
  return (day.isSame(start) || day.isAfter(start)) && day.isBefore(end);
};

export default function useWeeklySummary({
  weekStart = dayjs().startOf("week").toDate(),
  driverFilter = "",
  refreshKey = 0,
} = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    const unsub = subscribeTimeLogs(
      async (logs) => {
        if (!isMounted) return;
        try {
          const byDriver = new Map();
          logs.forEach((r) => {
            if (!inWeek(r.startTime || r.loggedAt, weekStart)) return;
            if (driverFilter && r.driverEmail !== driverFilter) return;
            const key = r.driverEmail || "Unknown";
            const prev = byDriver.get(key) || {
              driver: key,
              driverEmail: r.driverEmail || "Unknown",
              sessions: 0,
              totalMinutes: 0,
              firstStart: null,
              lastEnd: null,
            };
            const start = r.startTime;
            const end = r.endTime;
            // Use duration field (already in minutes) from normalized data
            const mins = r.duration || r.durationMin || r.minutes || 0;
            const firstStart =
              !prev.firstStart ||
              (start && start.seconds < prev.firstStart?.seconds)
                ? start
                : prev.firstStart;
            const lastEnd =
              !prev.lastEnd || (end && end.seconds > prev.lastEnd?.seconds)
                ? end
                : prev.lastEnd;
            byDriver.set(key, {
              driver: key,
              driverEmail: r.driverEmail || "Unknown",
              sessions: prev.sessions + 1,
              totalMinutes: prev.totalMinutes + mins,
              firstStart,
              lastEnd,
            });
          });
          let arr = Array.from(byDriver.values()).map((x) => ({
            id: x.driver,
            driver: x.driver,
            driverEmail: x.driverEmail,
            sessions: x.sessions,
            totalMinutes: x.totalMinutes,
            hours: x.totalMinutes / 60,
            firstStart: x.firstStart,
            lastEnd: x.lastEnd,
          }));
          arr = await enrichDriverNames(arr);
          if (!isMounted) return;
          setRows(arr);
          setError(null);
        } catch (err) {
          logError(err, { where: "useWeeklySummary", action: "process" });
          if (isMounted) {
            setError("Failed to build weekly summary.");
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      },
      (err) => {
        if (!isMounted) return;
        logError(err, { where: "useWeeklySummary", action: "subscribe" });
        setError(err?.message || "Failed to load weekly summary.");
        setLoading(false);
      },
    );

    return () => {
      isMounted = false;
      if (typeof unsub === "function") {
        unsub();
      }
    };
  }, [driverFilter, refreshKey, weekStart]);

  return { rows, loading, error };
}
