import { useEffect, useState } from "react";
import dayjs from "dayjs";

import { subscribeTimeLogs } from "./firestore";

const inWeek = (d, startOfWeek) => {
  if (!d) return false;
  const day = dayjs(d);
  const start = dayjs(startOfWeek).startOf("week");
  const end = start.add(1, "week");
  return day.isAfter(start) && day.isBefore(end);
};

export default function useWeeklySummary({
  weekStart = dayjs().startOf("week").toDate(),
  driverFilter = "",
} = {}) {
    const [rows, setRows] = useState([]);
    useEffect(() => {
      const unsub = subscribeTimeLogs((logs) => {
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
          const mins = Math.floor((r.durationMs || 0) / 60000);
          const firstStart =
            !prev.firstStart || (start && start.seconds < prev.firstStart.seconds)
              ? start
              : prev.firstStart;
          const lastEnd =
            !prev.lastEnd || (end && end.seconds > prev.lastEnd.seconds) ? end : prev.lastEnd;
          byDriver.set(key, {
            driver: key,
            driverEmail: r.driverEmail || "Unknown",
            sessions: prev.sessions + 1,
            totalMinutes: prev.totalMinutes + mins,
            firstStart,
            lastEnd,
          });
        });
        setRows(
          Array.from(byDriver.values()).map((x) => ({
            id: x.driver,
            driver: x.driver,
            driverEmail: x.driverEmail,
            sessions: x.sessions,
            totalMinutes: x.totalMinutes,
            hours: x.totalMinutes / 60,
            firstStart: x.firstStart,
            lastEnd: x.lastEnd,
          })),
        );
      });
      return () => unsub && unsub();
    }, [weekStart, driverFilter]);
    return rows;
  }
