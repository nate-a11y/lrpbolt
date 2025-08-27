/* Proprietary and confidential. See LICENSE. */

// Rides
export const RIDE_FIELDS = [
  "tripId","pickupTime","rideDuration","rideType","vehicle","rideNotes",
  "claimedBy","claimedAt","status",
  "createdAt","createdBy","updatedAt","lastModifiedBy"
];

// Time Logs
export const TIMELOG_FIELDS = [
  "driver","driverEmail","rideId","startTime","endTime","duration","loggedAt","note"
];

// Shootout Stats
export const SHOOTOUT_FIELDS = [
  "driverEmail","vehicle","startTime","endTime","trips","passengers","createdAt"
];
