// [LRP:BEGIN:calendar:utils]
/* Proprietary and confidential. See LICENSE. */
import * as htmlToImage from "html-to-image";

import dayjs, { toDayjs } from "@/utils/dayjsSetup.js";
import logError from "@/utils/logError.js";

const TZ = dayjs.tz?.guess?.() || "America/Chicago";

/** Normalize Firestore Timestamp/ISO/number/Date → dayjs (null-safe) */
export function toDj(x) {
  try {
    return toDayjs(x, TZ);
  } catch (e) {
    logError(e, { area: "calendarExport", action: "toDj" });
    return null;
  }
}

/** Export a DOM node to PNG and trigger download */
export async function exportNodeToPng(
  node,
  { fileBase = "LRP-calendar" } = {},
) {
  if (!node) return;
  try {
    const dataUrl = await htmlToImage.toPng(node, {
      pixelRatio: 2,
      quality: 0.98,
      backgroundColor: "#060606",
      style: { transform: "scale(1)", transformOrigin: "top left" },
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${fileBase}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    logError(e, { area: "calendarExport", action: "exportNodeToPng" });
  }
}

/** Build a minimal ICS file text from rides (start,end,summary,location,description) */
export function buildICS({ calendarName = "LRP Rides", items = [] }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lake Ride Pros//Calendar//EN",
    `X-WR-CALNAME:${calendarName}`,
  ];

  items.forEach((it, idx) => {
    const s = toDj(it.startTime) || toDj(it.start) || null;
    const e = toDj(it.endTime) || toDj(it.end) || null;
    if (!s || !e || !s.isValid() || !e.isValid()) return;

    const dtStart = s.tz(TZ).format("YYYYMMDD[T]HHmmss");
    const dtEnd = e.tz(TZ).format("YYYYMMDD[T]HHmmss");
    const uid = `${dtStart}-${idx}@lakeridepros.xyz`;

    const summary = (it.summary || it.title || it.vehicle || "LRP Ride")
      .toString()
      .replace(/\n/g, " ");
    const loc = (it.location || it.pickup || "").toString().replace(/\n/g, " ");
    const desc = (it.description || it.notes || "")
      .toString()
      .replace(/\n/g, " ");

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dayjs().utc().format("YYYYMMDD[T]HHmmss[Z]")}`);
    lines.push(`DTSTART;TZID=${TZ}:${dtStart}`);
    lines.push(`DTEND;TZID=${TZ}:${dtEnd}`);
    lines.push(`SUMMARY:${summary}`);
    if (loc) lines.push(`LOCATION:${loc}`);
    if (desc) lines.push(`DESCRIPTION:${desc}`);
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(text, fileBase = "LRP-rides") {
  try {
    const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    logError(e, { area: "calendarExport", action: "downloadICS" });
  }
}
/** Best-effort share: Web Share API if available, else copy to clipboard */
export async function shareDeepLink({ url, text }) {
  try {
    if (navigator.share) {
      await navigator.share({ url, text, title: "Lake Ride Pros" });
      return true;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch (e) {
    logError(e, { area: "calendarExport", action: "shareDeepLink" });
  }
  return false;
}
// [LRP:END:calendar:utils]
