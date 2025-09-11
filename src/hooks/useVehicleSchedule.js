/* Proprietary and confidential. See LICENSE. */
import { useMemo } from "react";
import dayjs from "dayjs";

import {
  toDayjs,
  hasOverlap,
  computeTightGaps,
} from "@/utils/scheduleUtils.js";

/**
 * Normalizes rides, groups per vehicle, and computes overlap/tight-gap counts.
 * @param {Object} params
 * @param {Array} params.rides
 * @param {Array} params.vehicles
 * @param {dayjs.Dayjs} params.day
 * @param {string} params.tz
 */
export function useVehicleSchedule({ rides = [], vehicles = [], day, tz }) {
  const dayStart = useMemo(
    () => (day ? day.startOf("day") : dayjs().tz(tz).startOf("day")),
    [day, tz],
  );
  const dayEnd = useMemo(() => dayStart.add(1, "day"), [dayStart]);

  const ridesByVehicle = useMemo(() => {
    const m = new Map();
    vehicles.forEach((v) => m.set(v.id, []));
    rides.forEach((r) => {
      const vid = r.vehicleId || r.vehicle || r.vehicleID || r.vehicle_id;
      if (!vid) return;
      const start = toDayjs(r.startTime, tz);
      const end = toDayjs(r.endTime, tz);
      if (!start || !end) return;
      const inWindow = end.isAfter(dayStart) && start.isBefore(dayEnd);
      if (!inWindow) return;
      const row = { ...r, start, end };
      if (!m.has(vid)) m.set(vid, []);
      m.get(vid).push(row);
    });
    // sort each vehicle’s rides by start
    for (const [, arr] of m) {
      arr.sort((a, b) => a.start.valueOf() - b.start.valueOf());
    }
    return m;
  }, [rides, vehicles, dayStart, dayEnd, tz]);

  const overlapsByVehicle = useMemo(() => {
    const res = new Map();
    for (const [vid, arr] of ridesByVehicle) {
      let overlaps = 0;
      for (let i = 0; i < arr.length - 1; i += 1) {
        if (
          hasOverlap(arr[i].start, arr[i].end, arr[i + 1].start, arr[i + 1].end)
        )
          overlaps += 1;
      }
      res.set(vid, overlaps);
    }
    return res;
  }, [ridesByVehicle]);

  const tightGapsByVehicle = useMemo(() => {
    const res = new Map();
    for (const [vid, arr] of ridesByVehicle) {
      res.set(vid, computeTightGaps(arr, 20));
    }
    return res;
  }, [ridesByVehicle]);

  const totals = useMemo(() => {
    let ridesCount = 0;
    let vehiclesCount = 0;
    let overlaps = 0;
    let tightGaps = 0;
    for (const [vid, arr] of ridesByVehicle) {
      if (arr.length > 0) vehiclesCount += 1;
      ridesCount += arr.length;
      overlaps += overlapsByVehicle.get(vid) || 0;
      tightGaps += tightGapsByVehicle.get(vid) || 0;
    }
    return { rides: ridesCount, vehicles: vehiclesCount, overlaps, tightGaps };
  }, [ridesByVehicle, overlapsByVehicle, tightGapsByVehicle]);

  return {
    dayStart,
    dayEnd,
    ridesByVehicle,
    overlapsByVehicle,
    tightGapsByVehicle,
    totals,
  };
}
