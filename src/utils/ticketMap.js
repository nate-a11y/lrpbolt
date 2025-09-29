import { formatDateTime as fmtDT, toDayjs, dayjs } from "@/utils/time";

export function getId(r) {
  return r?.id ?? r?.ticketId ?? null;
}

export function getLink(r) {
  return r?.linkUrl ?? r?.link ?? null;
}

export function getPassenger(r) {
  return r?.passenger ?? "N/A";
}

export function getPickup(r) {
  return r?.pickup ?? "N/A";
}

export function getDropoff(r) {
  return r?.dropoff ?? "N/A";
}

export function getPickupTime(r) {
  const ts = r?.pickupTime ?? r?.pickupDate ?? null;
  const d = toDayjs(ts);
  if (d) {
    try {
      return d.tz(dayjs.tz.guess()).format("MMM D, YYYY h:mm A");
    } catch {
      const safe = fmtDT(d);
      return safe && safe !== "N/A" ? safe : d.format("MMM D, YYYY h:mm A");
    }
  }
  if (r?.pickupDateStr && r?.pickupTimeStr) {
    return `${r.pickupDateStr} ${r.pickupTimeStr}`;
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
