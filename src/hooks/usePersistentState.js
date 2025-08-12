import { useEffect, useState } from "react";

import { logError } from "../utils/logError";

export default function usePersistentState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch (err) {
      logError(err, "usePersistentState:read");
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (err) {
      logError(err, "usePersistentState:write");
      // ignore write errors
    }
  }, [key, state]);

  return [state, setState];
}
