/* Proprietary and confidential. See LICENSE. */
// tests/unit/formatClaimSms.test.js
import { expect, test } from "vitest";

import { formatClaimSms } from "../../src/utils/formatClaimSms.js";
import {
  fmtDate,
  fmtTime,
  fmtDurationHM,
  safe,
} from "../../src/utils/rideFormatters.js";

test("formats ride claim SMS with vehicle", () => {
  const pickupTime = new Date("2024-01-01T18:00:00Z");
  const claimTime = new Date("2024-01-01T19:30:00Z");
  const ride = {
    tripId: "TRIP42",
    vehicle: "Sedan",
    rideDuration: 90,
    rideType: "Airport",
    rideNotes: "Leave at lobby",
  };

  const message = formatClaimSms(ride, pickupTime, claimTime);

  const expected =
    `Trip ID: ${ride.tripId}\n` +
    `Vehicle: ${safe(ride.vehicle)}\n` +
    `Date/Time: ${fmtDate(pickupTime)} ${fmtTime(pickupTime)}\n` +
    `Duration: ${fmtDurationHM(Number(ride.rideDuration))}\n` +
    `Trip Type: ${safe(ride.rideType)}\n` +
    `Trip Notes: ${safe(ride.rideNotes, "none")}\n\n` +
    `Claimed At: ${fmtDate(claimTime)} ${fmtTime(claimTime)}`;

  expect(message).toBe(expected);
});
