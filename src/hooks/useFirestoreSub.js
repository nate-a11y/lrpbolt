import { useEffect, useMemo } from "react";
import { subscribeOnce } from "../utils/firestoreListenerRegistry";

/**
 * @param {string} key  Stable id (e.g., 'rides:driver=abc|date=2025-08-21')
 * @param {() => import('firebase/firestore').Query|null} buildQuery
 * @param {(snap) => void} onNext
 * @param {(err) => void} onError
 * @param {any[]} deps  Dependencies for buildQuery memoization
 */
export default function useFirestoreSub(key, buildQuery, onNext, onError, deps) {
  const q = useMemo(() => buildQuery?.() ?? null, deps);
  useEffect(() => {
    if (!q) return;
    const unsub = subscribeOnce(key, q, onNext, onError);
    return () => unsub();
  }, [key, q, onNext, onError]);
}
