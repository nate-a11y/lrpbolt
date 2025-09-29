import { toDayjs, dayjs, formatDateTime as fmtDT } from "@/utils/time";

const val = (r, keys) => {
  const o = r || {};
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
};

export const getId = (r) => r?.id ?? r?.ticketId ?? null;
export const getTicketId = (r) => r?.ticketId ?? r?.id ?? "N/A";
export const getPassenger = (r) => r?.passenger ?? "N/A";
export const getPassengerCount = (r) =>
  val(r, ["passengerCount", "passengercount"]) ?? "N/A";
export const getPickup = (r) => r?.pickup ?? "N/A";
export const getDropoff = (r) => r?.dropoff ?? "N/A";
export const getLink = (r) => r?.linkUrl ?? r?.link ?? null;

export function getPickupTimeText(r) {
  const raw = r?.pickupTime ?? r?.pickupDate ?? null;
  const d = toDayjs(raw);
  if (d) {
    try {
      return d.tz(dayjs.tz.guess()).format("MMM D, YYYY h:mm A");
    } catch {
      const fallback = fmtDT(d);
      if (fallback && fallback !== "N/A") return fallback;
      return d.format("MMM D, YYYY h:mm A");
    }
  }
  if (r?.pickupDateStr || r?.pickupTimeStr) {
    return [r?.pickupDateStr, r?.pickupTimeStr].filter(Boolean).join(" ");
  }
  return "N/A";
}

export function getScanStatus(r) {
  const out = !!r?.scannedOutbound;
  const ret = !!r?.scannedReturn;
  if (out && ret) return "Both";
  if (out) return "Outbound";
  if (ret) return "Return";
  return "Unscanned";
}

export function getScanMeta(r) {
  return {
    outAt: r?.scannedOutboundAt ?? null,
    outBy: r?.scannedOutboundBy ?? null,
    retAt: r?.scannedReturnAt ?? null,
    retBy: r?.scannedReturnBy ?? null,
  };
}
