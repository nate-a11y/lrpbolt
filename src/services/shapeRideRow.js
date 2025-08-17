/* Proprietary and confidential. See LICENSE. */
import { tsToDate, fmtDate, fmtTime, hhmm } from "../utils/timeCoerce";

/**
 * Convert a Firestore ride doc into a grid row with derived display fields.
 * Keeps original fields for business logic; adds stable strings for the grid.
 */
export function shapeRideRow(d) {
  const raw = d.data();
  const pickup = tsToDate(raw.pickupTime);
  const duration = typeof raw.rideDuration === "number" ? raw.rideDuration : Number(raw.rideDuration);

  return {
    id: d.id,
    ...raw,
    // display strings used by the grids (no formatters needed)
    pickupDateStr: fmtDate(pickup),
    pickupTimeStr: fmtTime(pickup),
    rideDurationStr: hhmm(Number.isFinite(duration) ? duration : 0),
  };
}
