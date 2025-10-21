/* Proprietary and confidential. See LICENSE. */
/* LRP canonical trip states (single source of truth) */
export const TRIP_STATES = Object.freeze({
  QUEUED: "queued", // in queue, not yet live
  OPEN: "open", // live/unclaimed or in-progress
  CLAIMED: "claimed", // driver claimed (still active)
  COMPLETED: "completed",
  CANCELED: "canceled",
});

export const isQueued = (s) => s === TRIP_STATES.QUEUED;
export const isOpen = (s) => s === TRIP_STATES.OPEN;
export const isClaimed = (s) => s === TRIP_STATES.CLAIMED;
export const isTerminal = (s) =>
  s === TRIP_STATES.COMPLETED || s === TRIP_STATES.CANCELED;

export const VALID_TRANSITIONS = Object.freeze({
  [TRIP_STATES.QUEUED]: [TRIP_STATES.OPEN, TRIP_STATES.CANCELED],
  [TRIP_STATES.OPEN]: [TRIP_STATES.CLAIMED, TRIP_STATES.CANCELED],
  [TRIP_STATES.CLAIMED]: [TRIP_STATES.COMPLETED, TRIP_STATES.CANCELED],
  [TRIP_STATES.COMPLETED]: [],
  [TRIP_STATES.CANCELED]: [],
});

export function canTransition(from, to) {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}
