/* Proprietary and confidential. See LICENSE. */
import { tsToDate, fmtDate, fmtTime, hhmm } from "../utils/timeCoerce";

/**
 * Convert a Firestore ride doc into a grid row with derived display fields.
 * Keeps original fields for business logic; adds stable strings for the grid.
 */
export function shapeRideRow(d) {
  const raw = d.data();
  // Support legacy field names by falling back to capitalized keys
  const pickupRaw = raw.pickupTime ?? raw.PickupTime;
  const durationRaw = raw.rideDuration ?? raw.RideDuration;
  const pickup = tsToDate(pickupRaw);
  const duration =
    typeof durationRaw === "number" ? durationRaw : Number(durationRaw);

  return {
    id: d.id,
    ...raw,
    // ensure canonical field names exist for downstream code
    pickupTime: pickupRaw,
    rideDuration: durationRaw,
    // display strings used by the grids (no formatters needed)
    pickupDateStr: fmtDate(pickup),
    pickupTimeStr: fmtTime(pickup),
    rideDurationStr: hhmm(Number.isFinite(duration) ? duration : 0),
  };
}
