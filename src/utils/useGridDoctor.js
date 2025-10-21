/* Proprietary and confidential. See LICENSE. */
import { useEffect } from "react";

function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

export function useGridDoctor({ name, rows, columns, sample = 3 }) {
  useEffect(() => {
    const tag = `[GridDoctor:${name}]`;
    if (!Array.isArray(rows)) {
      console.warn(`${tag} rows is not an array`, rows);
      return;
    }
    if (!rows.length) {
      return;
    }
    // eslint-disable-next-line no-console
    console.log(`${tag} rows length:`, rows.length);
    const first = rows[0] || {};
    // eslint-disable-next-line no-console
    console.log(`${tag} first row keys:`, Object.keys(first));

    const sampleRows = rows.slice(0, sample);
    columns?.forEach((col) => {
      const { field, type, valueGetter } = col || {};
      if (!field || type === "actions") return;
      const calcValues = sampleRows.map((r) => {
        try {
          return valueGetter ? valueGetter({ row: r, field }) : r?.[field];
        } catch (e) {
          return `valueGetter threw: ${e?.message}`;
        }
      });
      const allMissing = calcValues.every((v) => v === undefined || v === null);
      if (allMissing) {
        console.warn(
          `${tag} Column "${field}" resolves to undefined/null for sample rows.`,
          calcValues,
        );
      }
    });
  }, [name, rows, columns, sample]);

  const dedupeRows = (prev, next) => {
    if (!Array.isArray(prev) || !Array.isArray(next)) return next;
    if (prev.length !== next.length) return next;
    for (let i = 0; i < next.length; i += 1) {
      if (!shallowEqual(prev[i], next[i])) return next;
    }
    return prev; // identical → don't trigger re-render loop
  };

  return { dedupeRows };
}
