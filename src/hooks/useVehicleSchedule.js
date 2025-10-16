/* Proprietary and confidential. See LICENSE. */
import { useMemo } from "react";

import dayjs from "@/utils/dayjsSetup.js";
import {
  normalizeRide,
  computeTightGaps,
  collectVehicleMeta,
} from "@/utils/scheduleUtils.js";

/**
 * Builds a day-scoped schedule with normalization and unioned vehicle IDs.
 * Keeps events that intersect the day window (clamped rendering), not just fully-contained.
 */
export function useVehicleSchedule({ rides = [], vehicles = [], day, tz }) {
  const dayStart = useMemo(
    () => (day ? day.startOf("day") : dayjs().tz(tz).startOf("day")),
    [day, tz],
  );
  const dayEnd = useMemo(() => dayStart.add(1, "day"), [dayStart]);

  const normalizedRides = useMemo(() => {
    return rides
      .map((raw) => normalizeRide(raw, tz))
      .filter(
        (r) =>
          r &&
          r.start &&
          r.end &&
          r.end.isAfter(dayStart) &&
          r.start.isBefore(dayEnd),
      );
  }, [rides, tz, dayStart, dayEnd]);

  const vehicleMetaById = useMemo(
    () => collectVehicleMeta(vehicles, normalizedRides),
    [vehicles, normalizedRides],
  );
  const vehicleIdsAll = useMemo(
    () => Array.from(vehicleMetaById.keys()),
    [vehicleMetaById],
  );

  const ridesByVehicle = useMemo(() => {
    const map = new Map(vehicleIdsAll.map((id) => [id, []]));
    normalizedRides.forEach((r) => {
      const id = r.vehicleId || "unknown";
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(r);
    });
    for (const [, arr] of map)
      arr.sort((a, b) => a.start.valueOf() - b.start.valueOf());
    return map;
  }, [normalizedRides, vehicleIdsAll]);

  const overlapsByVehicle = useMemo(() => {
    const res = new Map();
    for (const [vid, arr] of ridesByVehicle) {
      let overlaps = 0;
      for (let i = 0; i < arr.length - 1; i += 1) {
        const a = arr[i],
          b = arr[i + 1];
        if (a.end.isAfter(b.start) && b.end.isAfter(a.start)) overlaps += 1;
      }
      res.set(vid, overlaps);
    }
    return res;
  }, [ridesByVehicle]);

  const tightGapsByVehicle = useMemo(() => {
    const res = new Map();
    for (const [vid, arr] of ridesByVehicle)
      res.set(vid, computeTightGaps(arr, 20));
    return res;
  }, [ridesByVehicle]);

  const totals = useMemo(() => {
    let ridesCount = 0,
      vehiclesCount = 0,
      overlaps = 0,
      tightGaps = 0;
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
    normalizedRides,
    ridesByVehicle,
    overlapsByVehicle,
    tightGapsByVehicle,
    totals,
    vehicleIdsAll,
    vehicleMetaById,
  };
}
