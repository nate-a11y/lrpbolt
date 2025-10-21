/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useState } from "react";

import { COLLECTIONS } from "@/constants.js";
import { TRIP_STATES } from "@/constants/tripStates.js";
import { subscribeRides } from "@/services/firestoreService";
import logError from "@/utils/logError.js";

/**
 * Subscribe to rides by state. Converts Firestore Timestamp to JS Date at the edge.
 * Returns { rows, loading, error }.
 */
export function useTripsByState(state) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const collectionName = useMemo(() => {
    switch (state) {
      case TRIP_STATES.QUEUED:
        return COLLECTIONS.RIDE_QUEUE;
      case TRIP_STATES.OPEN:
        return COLLECTIONS.LIVE_RIDES;
      case TRIP_STATES.CLAIMED:
        return COLLECTIONS.CLAIMED_RIDES;
      default:
        return null;
    }
  }, [state]);

  useEffect(() => {
    if (!state) {
      const err = new Error("state is required for useTripsByState");
      logError(err, { where: "useTripsByState", phase: "init" });
      setRows([]);
      setLoading(false);
      setError(err);
      return () => {};
    }

    if (!collectionName) {
      const err = new Error(`Unsupported trip state: ${state}`);
      logError(err, { where: "useTripsByState", phase: "map", state });
      setRows([]);
      setLoading(false);
      setError(err);
      return () => {};
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeRides(
      collectionName,
      (nextRows) => {
        try {
          const mapped = (nextRows || []).map((row) => {
            if (!row || typeof row !== "object") {
              return row;
            }

            const raw =
              row._raw && typeof row._raw === "object" ? row._raw : {};
            const statusCandidate =
              typeof row.status === "string" && row.status.trim()
                ? row.status.trim()
                : typeof row.state === "string" && row.state.trim()
                  ? row.state.trim()
                  : typeof raw.status === "string" && raw.status.trim()
                    ? raw.status.trim()
                    : typeof raw.state === "string" && raw.state.trim()
                      ? raw.state.trim()
                      : state;

            const statusValue = statusCandidate || state;

            return {
              ...row,
              status: statusValue,
              state: statusValue,
              _raw: { ...raw, status: statusValue, state: statusValue },
            };
          });

          setRows(mapped);
          setLoading(false);
          setError(null);
        } catch (err) {
          logError(err, {
            where: "useTripsByState.transform",
            state,
            collectionName,
          });
          setRows(Array.isArray(nextRows) ? nextRows : []);
          setLoading(false);
          setError(err);
        }
      },
      (err) => {
        logError(err, {
          where: "useTripsByState.subscribe",
          state,
          collectionName,
        });
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      try {
        unsubscribe?.();
      } catch (err) {
        logError(err, {
          where: "useTripsByState.cleanup",
          state,
          collectionName,
        });
      }
    };
  }, [collectionName, state]);

  return { rows, loading, error };
}
