/* Grid-safe formatters and helpers */

export const EM_DASH = "—";

/** Safely walk nested keys like "a.b.c" */
export function getNested(obj, path) {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Firestore Timestamp, ISO, millis → Date */
export function toJSDate(v) {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(+d) ? undefined : d;
}

/** Ascending date comparator for DataGrid sortComparator */
export function dateSort(a, b) {
  const da = toJSDate(a);
  const db = toJSDate(b);
  return (+da || 0) - (+db || 0);
}

/** Text formatter with null/empty guarding */
export const safeTextFormatter = (fallback = EM_DASH) => (params = {}) => {
  const raw = params.value ?? getNested(params.row, params.field);
  if (raw === null || raw === undefined) return fallback;
  const s = typeof raw === "string" ? raw.trim() : raw;
  return s === "" ? fallback : String(s);
};

/** Date formatter that accepts a (Date) => string function */
export const safeDateFormatter = (formatFn, fallback = EM_DASH) => (
  params = {},
) => {
  const raw = params.value ?? getNested(params.row, params.field);
  const d = toJSDate(raw);
  if (!d) return fallback;
  try {
    return typeof formatFn === "function" ? formatFn(d) : d.toLocaleString();
  } catch {
    return fallback;
  }
};

/** Reasonable default date-time cell (Intl); no dayjs dependency */
export const fmtDateTimeCell = (options = {}, fallback = EM_DASH) =>
  safeDateFormatter((d) => {
    const fmt = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...options,
    });
    return fmt.format(d);
  }, fallback);

/**
 * Wrap columns with safety:
 * - Never apply valueFormatter to actions/checkbox columns
 * - Guard any existing valueFormatter from null params
 * - If a data column lacks formatter/renderers, attach safeTextFormatter()
 */
export function makeColumnsSafe(columns) {
  return columns.map((col) => {
    const c = { ...col };

    // Skip non-data columns
    if (c.type === "actions" || c.type === "checkboxSelection") {
      // Ensure no inherited formatter accidentally leaks here
      delete c.valueFormatter;
      delete c.valueGetter;
      return c;
    }

    // Guard existing valueFormatter
    if (c.valueFormatter) {
      const vf = c.valueFormatter;
      c.valueFormatter = (params) => vf(params ?? {});
      return c;
    }

    // Provide a safe text fallback if nothing else formats it
    if (!c.renderCell && !c.renderEditCell) {
      c.valueFormatter = safeTextFormatter();
    }
    return c;
  });
}

/** Alias for ergonomics */
export const withSafeColumns = makeColumnsSafe;

/**
 * Build a correct actions column (no valueGetter/formatter)
 * Supply a getActions(params) => GridActionsCellItem[].
 */
export function buildActionsCol(getActions, overrides = {}) {
  return {
    field: "actions",
    type: "actions",
    headerName: "",
    width: 80,
    getActions,
    ...overrides,
  };
}

// Backwards compatibility aliases
export const fmtPlain = (fallback = EM_DASH) => safeTextFormatter(fallback);

export function warnMissingFields(columns, rows, sample = 10) {
  if (!Array.isArray(columns) || !Array.isArray(rows) || !rows.length) return;
  const r = rows.slice(0, sample);
  columns.forEach((c) => {
    if (!c?.field || c?.type === "actions") return;
    const anyHas = r.some((row) =>
      Object.prototype.hasOwnProperty.call(row, c.field),
    );
    if (!anyHas && !c.valueGetter) {
      console.warn(
        `[DataGrid] Field "${c.field}" not found on rows and no valueGetter provided.`,
      );
    }
  });
}

export default {
  EM_DASH,
  getNested,
  toJSDate,
  dateSort,
  safeTextFormatter,
  safeDateFormatter,
  fmtDateTimeCell,
  makeColumnsSafe,
  withSafeColumns,
  buildActionsCol,
  fmtPlain,
  warnMissingFields,
};

