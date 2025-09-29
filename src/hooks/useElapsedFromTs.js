/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useRef, useState } from "react";
import dayjsLib from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";

import logError from "@/utils/logError.js";

dayjsLib.extend(utc);
dayjsLib.extend(tz);
const resolveDayjs = (...args) => {
  try {
    return dayjsLib.tz(...args, dayjsLib.tz.guess());
  } catch (error) {
    logError(error, { where: "useElapsedFromTs", action: "tzGuess" });
    return dayjsLib(...args);
  }
};

export default function useElapsedFromTs(ts) {
  const [, setTick] = useState(0);
  const timerRef = useRef(null);

  const start = useMemo(() => {
    try {
      return ts && typeof ts.toDate === "function"
        ? resolveDayjs(ts.toDate())
        : null;
    } catch (error) {
      logError(error, { where: "useElapsedFromTs", action: "parse" });
      return null;
    }
  }, [ts]);

  useEffect(() => {
    if (!start) return undefined;
    timerRef.current = setInterval(() => {
      setTick((value) => (value + 1) % 1_000_000_000);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [start]);

  let elapsedMs = 0;
  if (start) {
    try {
      const diff = resolveDayjs().diff(start);
      elapsedMs = Number.isFinite(diff) && diff > 0 ? diff : 0;
    } catch (error) {
      logError(error, { where: "useElapsedFromTs", action: "elapsed" });
    }
  }

  return { start, elapsedMs };
}
