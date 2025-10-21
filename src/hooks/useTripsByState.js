/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState } from "react";

import logError from "@/utils/logError.js";
import { subscribeRides } from "@/services/firestoreService.js";
import { COLLECTIONS } from "@/constants.js";
import { TRIP_STATES } from "@/constants/tripStates.js";

const STATE_COLLECTIONS = Object.freeze({
  [TRIP_STATES.QUEUED]: COLLECTIONS.RIDE_QUEUE,
  [TRIP_STATES.OPEN]: COLLECTIONS.LIVE_RIDES,
  [TRIP_STATES.CLAIMED]: COLLECTIONS.CLAIMED_RIDES,
});

const isString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const deriveState = (row, fallback) => {
  if (!row || typeof row !== "object") return fallback || null;
  const directState = row.state;
  if (isString(directState)) return directState;
  const directStatus = row.status;
  if (isString(directStatus)) return directStatus;
  const raw = row._raw;
  if (raw && typeof raw === "object") {
    const rawState = raw.state;
    if (isString(rawState)) return rawState;
    const rawStatus = raw.status;
    if (isString(rawStatus)) return rawStatus;
    const rawQueueStatus = raw.queueStatus ?? raw.QueueStatus;
    if (isString(rawQueueStatus)) return rawQueueStatus;
  }
  const queueStatus = row.queueStatus ?? row.QueueStatus;
  if (isString(queueStatus)) return queueStatus;
  return fallback || null;
};

const applyLegacyState = (row, fallbackState) => {
  const stateValue = deriveState(row, fallbackState);
  const statusValue = isString(row?.status)
    ? row.status
    : isString(row?._raw?.status)
      ? row._raw.status
      : stateValue;
  const queueStatusValue = isString(row?.queueStatus)
    ? row.queueStatus
    : isString(row?.QueueStatus)
      ? row.QueueStatus
      : isString(row?._raw?.queueStatus)
        ? row._raw.queueStatus
        : isString(row?._raw?.QueueStatus)
          ? row._raw.QueueStatus
          : stateValue;

  return {
    ...row,
    state: stateValue,
    status: statusValue,
    queueStatus: queueStatusValue,
    _raw: {
      ...(row?._raw || {}),
      state: stateValue,
      status: statusValue,
      queueStatus: queueStatusValue,
      QueueStatus: queueStatusValue,
    },
  };
};

/**
 * Subscribe to rides by state. Converts Firestore Timestamp to JS Date at the edge.
 * Returns { rows, loading, error }.
 */
export function useTripsByState(state) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!state) {
      const err = new Error("state is required for useTripsByState");
      logError(err, { where: "useTripsByState", phase: "init" });
      setRows([]);
      setLoading(false);
      setError(err);
      return () => {};
    }

    const collectionName = STATE_COLLECTIONS[state] || null;
    if (!collectionName) {
      const err = new Error(`Unsupported trip state: ${state}`);
      logError(err, { where: "useTripsByState", phase: "collection" });
      setRows([]);
      setLoading(false);
      setError(err);
      return () => {};
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeRides(
      collectionName,
      (incoming) => {
        try {
          const next = (incoming || []).map((row) =>
            applyLegacyState(row, state),
          );
          setRows(next);
          setLoading(false);
          setError(null);
        } catch (err) {
          logError(err, { where: "useTripsByState.map", state });
          setRows([]);
          setLoading(false);
          setError(err);
        }
      },
      (err) => {
        logError(err, { where: "useTripsByState.subscribe", state });
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      try {
        unsubscribe?.();
      } catch (err) {
        logError(err, { where: "useTripsByState.cleanup", state });
      }
    };
  }, [state]);

  return { rows, loading, error };
}
