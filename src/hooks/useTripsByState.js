/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/services/firebase.js";
import logError from "@/utils/logError.js";
import { normalizeRide } from "@/utils/normalizeRide.js";

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

    let unsubscribe = () => {};
    try {
      const ridesRef = collection(db, "rides");
      const q = query(
        ridesRef,
        where("status", "==", state),
        orderBy("pickupTime", "asc"),
      );
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const next = snapshot.docs.map((docSnap) => {
            const normalized = normalizeRide(docSnap);
            const raw = normalized?._raw || docSnap.data() || {};
            const statusValue =
              typeof raw.status === "string"
                ? raw.status
                : typeof raw.state === "string"
                  ? raw.state
                  : typeof normalized.status === "string"
                    ? normalized.status
                    : state;
            const stateValue =
              typeof raw.state === "string" && raw.state.trim()
                ? raw.state
                : statusValue;

            return {
              ...normalized,
              status: statusValue,
              state: stateValue,
              _raw: { ...raw, status: statusValue, state: stateValue },
            };
          });
          setRows(next);
          setLoading(false);
          setError(null);
        },
        (err) => {
          logError(err, { where: "useTripsByState.onSnapshot", state });
          setError(err);
          setLoading(false);
        },
      );
    } catch (err) {
      logError(err, { where: "useTripsByState.setup", state });
      setError(err);
      setLoading(false);
      return () => {};
    }

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
