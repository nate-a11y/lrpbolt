/* Proprietary and confidential. See LICENSE. */
import dayjs from "@/utils/dayjsSetup.js";

const DEFAULT_TZ = "America/Chicago";

export async function getVehicleEvents({
  calendarIds,
  start,
  end,
  tz: viewerTimezone,
  signal,
}) {
  const apiKey = import.meta.env.VITE_CALENDAR_API_KEY;
  const fallbackId = import.meta.env.VITE_CALENDAR_ID;
  const ids = (
    calendarIds && calendarIds.length ? calendarIds : [fallbackId]
  ).filter(Boolean);

  if (!apiKey || !ids.length) {
    throw new Error("Missing calendar API config");
  }

  const parseDayjs = (value) => {
    if (!value) return null;
    if (dayjs.isDayjs?.(value)) {
      return value;
    }
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed : null;
  };

  const startInstance = parseDayjs(start);
  const endInstance = parseDayjs(end);
  const baseDay =
    startInstance ||
    endInstance ||
    (typeof dayjs.tz === "function" ? dayjs().tz(DEFAULT_TZ) : dayjs());

  const rangeStart = startInstance || baseDay.startOf("day");
  const rangeEnd = endInstance || rangeStart.endOf("day");

  const timeMin = rangeStart.toISOString();
  const timeMax = rangeEnd.add(1, "millisecond").toISOString();

  const normalizedViewerTz =
    typeof viewerTimezone === "string" ? viewerTimezone.trim() : "";
  const timezone =
    normalizedViewerTz &&
    normalizedViewerTz.toLowerCase() === DEFAULT_TZ.toLowerCase()
      ? normalizedViewerTz
      : DEFAULT_TZ;

  const fetchForId = async (calendarId) => {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId,
      )}/events`,
    );
    url.searchParams.set("key", apiKey);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    if (timezone) {
      url.searchParams.set("timeZone", timezone);
    }

    const response = await fetch(url.toString(), { signal });
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} when fetching calendar ${calendarId}: ${response.statusText}`,
      );
    }

    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return items.map((item) => ({ ...item, calendarId }));
  };

  const results = await Promise.all(
    ids.map((calendarId) => fetchForId(calendarId)),
  );
  return { events: results.flat() };
}
