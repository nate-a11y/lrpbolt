/* Proprietary and confidential. See LICENSE. */
import { useRef, useCallback, useEffect } from "react";

/**
 * Provides a callback with stable identity whose implementation
 * always reflects the latest function passed in.
 */
export default function useStableCallback(fn) {
  const ref = useRef(fn);

  useEffect(() => {
    ref.current = fn;
  }, [fn]);

  return useCallback((...args) => ref.current?.(...args), []);
}
