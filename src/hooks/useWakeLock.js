/* Proprietary and confidential. See LICENSE. */
import { useEffect, useRef } from "react";

/**
 * Keeps a WakeLockSentinel alive while `enabled` is true.
 * - Persists the sentinel in a ref so it isn't GC'd
 * - Re-acquires on visibilitychange when document becomes visible
 * - Releases on disable/unmount
 */
export default function useWakeLock(enabled) {
  const sentinelRef = useRef(null);

  // Acquire lock
  async function acquire() {
    try {
      if (!enabled) return;
      if (!("wakeLock" in navigator)) return;
      if (document.visibilityState !== "visible") return;
      if (sentinelRef.current) return; // already held
      sentinelRef.current = await navigator.wakeLock.request("screen");
      sentinelRef.current.addEventListener("release", () => {
        // Browser may auto-release on tab switch / power events
        sentinelRef.current = null;
      });
    } catch (e) {
      console.error("[useWakeLock] acquire failed", e);
      sentinelRef.current = null;
    }
  }

  // Release lock
  async function release() {
    try {
      if (sentinelRef.current) {
        await sentinelRef.current.release();
        sentinelRef.current = null;
      }
    } catch (e) {
      console.error("[useWakeLock] release failed", e);
      sentinelRef.current = null;
    }
  }

  // Lifecycle
  useEffect(() => {
    if (enabled) {
      acquire();
    } else {
      release();
    }
    return () => {
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Re-acquire when returning to visible
  useEffect(() => {
    function onVis() {
      if (enabled) acquire();
      else release();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
