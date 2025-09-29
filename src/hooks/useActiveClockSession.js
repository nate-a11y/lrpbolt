/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/utils/firebaseInit.js";
import { getCurrentUserId } from "@/services/auth.js";
import { dayjs, toDayjs } from "@/utils/time";
import logError from "@/utils/logError.js";

const getTz = () => {
  try {
    return dayjs.tz?.guess?.() || "UTC";
  } catch (error) {
    logError(error, { where: "useActiveClockSession", action: "guessTz" });
    return "UTC";
  }
};

/**
 * Subscribes to the current user's active time log (endTime == null).
 * Returns { active, startTs, start, elapsedMs } with 1s ticking.
 */
export default function useActiveClockSession() {
  const [docData, setDocData] = useState(null);
  const [_tick, setTick] = useState(0);
  const tickRef = useRef(null);

  useEffect(() => {
    const uid = typeof getCurrentUserId === "function" ? getCurrentUserId() : null;
    if (!uid) {
      setDocData(null);
      return undefined;
    }

    const q = query(
      collection(db, "timeLogs"),
      where("userId", "==", uid),
      where("endTime", "==", null),
      orderBy("startTime", "desc"),
      limit(1),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const hit = snapshot?.docs?.[0]?.data?.() || null;
        setDocData(hit);
      },
      (error) => {
        logError(error, {
          where: "useActiveClockSession",
          action: "onSnapshot",
        });
        setDocData(null);
      },
    );

    return () => {
      try {
        unsubscribe();
      } catch (error) {
        logError(error, { where: "useActiveClockSession", action: "unsubscribe" });
      }
    };
  }, []);

  const startTs = docData?.startTime ?? null;
  const start = useMemo(() => {
    const asDayjs = toDayjs(startTs);
    if (!asDayjs) return null;
    try {
      return asDayjs.tz(getTz());
    } catch (error) {
      logError(error, { where: "useActiveClockSession", action: "tz" });
      return asDayjs;
    }
  }, [startTs]);

  useEffect(() => {
    if (!start) return undefined;
    tickRef.current = setInterval(() => {
      setTick((value) => (value + 1) % 1_000_000);
    }, 1000);

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [start]);

  let elapsedMs = 0;
  if (start) {
    try {
      const diff = dayjs().tz(getTz()).diff(start);
      elapsedMs = Number.isFinite(diff) && diff > 0 ? diff : 0;
    } catch (error) {
      logError(error, { where: "useActiveClockSession", action: "elapsed" });
    }
  }

  return { active: Boolean(start), startTs, start, elapsedMs };
}
