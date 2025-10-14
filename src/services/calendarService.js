/* Proprietary and confidential. See LICENSE. */
import dayjs from "dayjs";

// ✅ use your existing var
const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE = RAW_BASE.replace(/\/$/, ""); // trim trailing slash

async function fetchJson(url, signal) {
  const res = await fetch(url, { credentials: "omit", signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getVehicleEvents({
  calendarIds,
  start,
  end,
  tz,
  signal,
}) {
  const params = new URLSearchParams();
  (calendarIds || []).forEach((id) => id && params.append("calendarId", id));
  params.set("timeMin", dayjs(start).toISOString());
  params.set("timeMax", dayjs(end).toISOString());
  if (tz) params.set("tz", tz);

  const url = `${API_BASE}/apiCalendarFetch?${params.toString()}`;
  return fetchJson(url, signal);
}
