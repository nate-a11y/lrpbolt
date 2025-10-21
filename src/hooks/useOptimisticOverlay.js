/* Proprietary and confidential. See LICENSE. */
import { useMemo, useRef, useCallback } from "react";

/**
 * Maintains immutable optimistic patches layered over base rows.
 *
 * @param {Array} baseRows - canonical rows from Firestore/onSnapshot
 * @param {Function} keyFn - stable function returning the row id
 */
export default function useOptimisticOverlay(baseRows, keyFn) {
  const patchesRef = useRef(new Map());

  const applyPatch = useCallback((id, patch) => {
    if (!id || !patch) return;
    const previous = patchesRef.current.get(id) || {};
    patchesRef.current.set(id, { ...previous, ...patch });
  }, []);

  const clearPatch = useCallback((id) => {
    if (!id) return;
    patchesRef.current.delete(id);
  }, []);

  const clearAll = useCallback(() => {
    patchesRef.current.clear();
  }, []);

  const getPatch = useCallback((id) => patchesRef.current.get(id), []);

  const rows = useMemo(() => {
    const source = Array.isArray(baseRows) ? baseRows : [];
    if (source.length === 0 || patchesRef.current.size === 0) {
      return source;
    }

    const merged = new Array(source.length);
    for (let index = 0; index < source.length; index += 1) {
      const row = source[index];
      const id = keyFn ? keyFn(row) : row?.id;
      const patch = id ? patchesRef.current.get(id) : null;
      merged[index] = patch ? { ...row, ...patch } : row;
    }
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseRows]);

  return { rows, applyPatch, clearPatch, clearAll, getPatch };
}
