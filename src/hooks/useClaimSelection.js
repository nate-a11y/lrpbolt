import { useCallback, useMemo, useState } from "react";

export default function useClaimSelection(getId = (r) => r?.id) {
  const [selected, setSelected] = useState(() => new Set());
  const isSelected = useCallback(
    (row) => selected.has(getId(row)),
    [selected, getId],
  );

  const toggle = useCallback(
    (row) => {
      const id = getId(row);
      setSelected((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    },
    [getId],
  );

  const updateMany = useCallback(
    (rows, shouldSelect) => {
      const ids = (rows || [])
        .map((row) => getId(row))
        .filter((id) => id != null);
      if (!ids.length) return;
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => {
          if (shouldSelect) next.add(id);
          else next.delete(id);
        });
        return next;
      });
    },
    [getId],
  );

  const toggleMany = useCallback(
    (rows) => {
      const ids = (rows || [])
        .map((row) => getId(row))
        .filter((id) => id != null);
      if (!ids.length) return;
      setSelected((prev) => {
        const next = new Set(prev);
        const shouldSelect = ids.some((id) => !next.has(id));
        ids.forEach((id) => {
          if (shouldSelect) next.add(id);
          else next.delete(id);
        });
        return next;
      });
    },
    [getId],
  );

  const clear = useCallback(() => setSelected(new Set()), []);
  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  return {
    isSelected,
    toggle,
    toggleMany,
    selectMany: (rows) => updateMany(rows, true),
    deselectMany: (rows) => updateMany(rows, false),
    clear,
    count: selected.size,
    selectedIds,
  };
}
