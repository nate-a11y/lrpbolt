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

  const clear = useCallback(() => setSelected(new Set()), []);
  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  return { isSelected, toggle, clear, count: selected.size, selectedIds };
}
