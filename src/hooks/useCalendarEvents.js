/* Proprietary and confidential. See LICENSE. */
import { useState, useEffect, useCallback } from "react";

import dayjs from "@/utils/dayjsSetup.js";
import { getVehicleEvents } from "@/services/calendarService.js";
import { getCalendarIdsForVehicles } from "@/constants/vehicleCalendars.js";
import logError from "@/utils/logError.js";

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Custom hook for fetching and caching calendar events
 * @param {string} dateISO - ISO date string (YYYY-MM-DD)
 * @param {object} filters - Filter configuration { vehicles: string[], scrollToNow: boolean }
 * @param {string} timezone - Timezone string (e.g., "America/Chicago")
 * @returns {object} { events: array, loading: boolean, error: Error|null, refetch: function }
 */
export function useCalendarEvents(
  dateISO,
  filters = {},
  timezone = "America/Chicago",
) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(() => {
    const vehiclesKey = (filters?.vehicles || []).sort().join(",");
    const key = `${dateISO}:${timezone}:${vehiclesKey}`;

    // Invalidate cache for this key
    cache.delete(key);

    setLoading(true);
    setError(null);
  }, [dateISO, filters?.vehicles, timezone]);

  useEffect(() => {
    const vehiclesKey = (filters?.vehicles || []).sort().join(",");
    const key = `${dateISO}:${timezone}:${vehiclesKey}`;

    // Check cache
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Setting state from cache
      setEvents(cached.events);

      setLoading(false);

      setError(null);
      return;
    }

    const controller = new AbortController();

    const fetchEvents = async () => {
      setLoading(true);
      setError(null);

      try {
        const fallbackPrimary = import.meta.env.VITE_CALENDAR_ID;
        const filterVehicles = filters?.vehicles || [];

        // Determine which vehicles to fetch
        const selectedVehicles = filterVehicles.includes("ALL")
          ? [] // Empty array means fetch all via fallback
          : filterVehicles;

        const calendarIds = selectedVehicles.length
          ? getCalendarIdsForVehicles(selectedVehicles, fallbackPrimary)
          : [fallbackPrimary].filter(Boolean);

        if (!calendarIds.length) {
          setEvents([]);
          setLoading(false);
          setError(
            new Error(
              "No calendar ID configured. Set VITE_CALENDAR_ID or vehicle mapping.",
            ),
          );
          return;
        }

        const date = dayjs.tz(dateISO, timezone);
        const { events: items } = await getVehicleEvents({
          calendarIds,
          start: date.startOf("day"),
          end: date.endOf("day"),
          tz: timezone,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        // Cache the results
        cache.set(key, {
          events: items,
          timestamp: Date.now(),
        });

        setEvents(items);
        setLoading(false);
      } catch (err) {
        if (!controller.signal.aborted) {
          logError(err, {
            area: "useCalendarEvents",
            action: "fetchEvents",
            hint: "calendar-service",
          });
          setError(err);
          setLoading(false);
        }
      }
    };

    fetchEvents();

    return () => controller.abort();
  }, [dateISO, filters?.vehicles, timezone]);

  return { events, loading, error, refetch };
}
