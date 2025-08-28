/* Proprietary and confidential. See LICENSE. */
// src/utils/formatClaimSms.js
import { fmtDate, fmtTime, fmtDurationHM, safe } from "./rideFormatters";

export const formatClaimSms = (ride, pickupTime, claimTime = new Date()) =>
  `Trip ID: ${ride.tripId}\n` +
  `Vehicle: ${safe(ride.vehicle)}\n` +
  `Date/Time: ${fmtDate(pickupTime)} ${fmtTime(pickupTime)}\n` +
  `Duration: ${fmtDurationHM(Number(ride.rideDuration ?? 0))}\n` +
  `Trip Type: ${safe(ride.rideType)}\n` +
  `Trip Notes: ${safe(ride.rideNotes, "none")}\n\n` +
  `Claimed At: ${fmtDate(claimTime)} ${fmtTime(claimTime)}`;

export default formatClaimSms;
