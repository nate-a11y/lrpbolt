/* Proprietary and confidential. See LICENSE. */
import dayjs from "dayjs";

import { fetchWithRetry } from "@/utils/network.js";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  "https://us-central1-lrp---claim-portal.cloudfunctions.net";

const responseCache = new Map();

async function fetchJson(url, signal) {
  if (responseCache.has(url)) {
    return responseCache.get(url);
  }
  const res = await fetchWithRetry(url, { credentials: "omit", signal });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  responseCache.set(url, data);
  return data;
}

export function clearCalendarServiceCache() {
  responseCache.clear();
}

export async function getVehicleEvents({
  calendarIds,
  start,
  end,
  tz,
  signal,
}) {
  const params = new URLSearchParams();
  (calendarIds || []).forEach((id) => params.append("calendarId", id));
  params.set("timeMin", dayjs(start).toISOString());
  params.set("timeMax", dayjs(end).toISOString());
  if (tz) params.set("tz", tz);
  const url = `${API_BASE}/apiCalendarFetch?${params.toString()}`;
  return fetchJson(url, signal);
}
