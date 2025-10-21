/* Proprietary and confidential. See LICENSE. */
import dayjs from "@/utils/dayjsSetup.js";

const DEFAULT_TZ = "America/Chicago";

export async function getVehicleEvents({
  calendarIds,
  start,
  end,
  tz,
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

  const timezone = tz || dayjs.tz?.guess?.() || DEFAULT_TZ;
  const day = dayjs(start || end || dayjs()).tz(timezone);
  const timeMin = day.startOf("day").toISOString();
  const timeMax = day.endOf("day").add(1, "millisecond").toISOString();

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
