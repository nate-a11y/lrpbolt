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
        const prev = byDriver.get(key) || { driver: key, trips: 0, minutes: 0 };
        const addMin = Math.floor((r.durationMs || 0) / 60000);
        byDriver.set(key, {
          driver: key,
          trips: prev.trips + (Number.isFinite(r.trips) ? r.trips : 0),
          minutes: prev.minutes + addMin,
        });
      });
      setRows(
        Array.from(byDriver.values()).map((x) => ({
          id: x.driver,
          driver: x.driver,
          trips: x.trips,
          hours: Math.floor((x.minutes / 60) * 100) / 100,
        })),
      );
    });
    return () => unsub && unsub();
  }, [weekStart, driverFilter]);
  return rows;
}
