/* Proprietary and confidential. See LICENSE. */
import { TIMEZONE } from "../constants";

import dayjs from "./dates";

/** Guard against MUI passing undefined params */
export const getRow = (params) => (params && params.row) ? params.row : null;

/** Timestamp | Date | ISO -> dayjs or null */
export const toDj = (v) => {
  try {
    const d = v?.toDate ? v.toDate() : v;
    const dj = dayjs(d);
    return dj.isValid() ? dj : null;
  } catch {
    return null;
  }
};

export const fmtDate = (v) => {
  const dj = toDj(v);
  return dj ? dj.tz(TIMEZONE).format("MM/DD/YYYY") : "N/A";
};

export const fmtTime = (v) => {
  const dj = toDj(v);
  return dj ? dj.tz(TIMEZONE).format("h:mm A") : "N/A";
};

/** Safe valueGetter examples */
export const getPickupTime = (params) => {
  const row = getRow(params);
  return row ? (row.pickupTime ?? null) : null;
};

export const getRideDuration = (params) => {
  const row = getRow(params);
  return row && Number.isFinite(row.rideDuration) ? row.rideDuration : null;
};

