/* Proprietary and confidential. See LICENSE. */
import React, { useMemo } from "react";
import { DataGridPro, GridToolbar } from "@mui/x-data-grid-pro";

import { formatDateTime, formatHMFromMinutes } from "../../utils/timeUtils";

const isFSTimestamp = (v) => !!v && typeof v?.toDate === "function";
const isFSTimestampLike = (v) =>
  v && typeof v === "object" && Number.isFinite(v.seconds) && Number.isFinite(v.nanoseconds);
const isDate = (v) => v instanceof Date;
const isBool = (v) => v === true || v === false;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

const looksLikeDurationField = (field = "") =>
  ["duration", "durationmins", "rideduration", "totalminutes"].includes(field.toLowerCase());

const widthFor = (field, sample) => {
  if (isFSTimestamp(sample) || isFSTimestampLike(sample)) return 200;
  if (looksLikeDurationField(field)) return 120;
  if (isNum(sample)) return 120;
  if (isBool(sample)) return 110;
  if ((field || "").toLowerCase().includes("id")) return 140;
  return 180;
};

function formatAny(field, v) {
  if (v === null || v === undefined) return "N/A";
  if (isFSTimestamp(v)) return formatDateTime(v);
  if (isFSTimestampLike(v)) {
    const ms = v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6);
    return formatDateTime(new Date(ms));
  }
  if (isDate(v)) return formatDateTime(v);
  if (looksLikeDurationField(field)) {
    if (isNum(v)) return formatHMFromMinutes(v);
    if (v && typeof v === "object" && isNum(v.minutes)) return formatHMFromMinutes(v.minutes);
    return "N/A";
  }
  if (isNum(v)) return String(v);
  if (isBool(v)) return v ? "Yes" : "No";
  if (typeof v === "string") return v.trim() === "" ? "N/A" : v;
  return ""; // never [object Object]
}

/** Universal, object-safe rendering — never “[object Object]”. */
function makeRenderCell(field) {
  return (params) => formatAny(field, params?.row?.[field]);
}

/** Provide clean values for CSV/Excel export */
function makeExportValue(field) {
  return (params) => formatAny(field, params?.row?.[field]);
}

function buildAutoCol(field, headerName, sampleValue) {
  return {
    field,
    headerName: headerName || field,
    width: widthFor(field, sampleValue),
    sortable: true,
    renderCell: makeRenderCell(field),
    getExportValue: makeExportValue(field),
  };
}

/** Build inferred columns from the first row */
function useAutoColumns(rows, { headerMap = {}, order = [], hide = [], overrides = {}, forceHide = [] } = {}) {
  return useMemo(() => {
    const first = rows?.find(Boolean) || {};
    const fields = Object.keys(first);
    const seen = new Set();
    const ordered = [
      ...order.filter((f) => fields.includes(f)).map((f) => (seen.add(f), f)),
      ...fields.filter((f) => !seen.has(f)),
    ];

    return ordered
      .filter((f) => !forceHide.includes(f)) // hard remove
      .map((field) => {
        const sample = first[field];
        const col = buildAutoCol(field, headerMap[field], sample);
        if (hide.includes(field)) col.hide = true; // soft hide (toggle-able)
        if (overrides[field]) Object.assign(col, overrides[field]);
        return col;
      });
  }, [rows, headerMap, order, hide, overrides, forceHide]);
}

/** Sanitize a legacy columns array (compat mode) */
function sanitizeCompatColumns(columns = [], forceHide = []) {
  return (columns || [])
    .filter((c) => !forceHide.includes(c?.field))
    .map((c, idx) => {
      const field = c?.field ?? `col_${idx}`;
      const headerName = c?.headerName || field;
      const out = { ...c, field, headerName };
      if (!out.width) out.width = 180;
      if (typeof out.renderCell !== "function" && out.type !== "actions") {
        out.renderCell = makeRenderCell(field);
      }
      if (typeof out.getExportValue !== "function") {
        out.getExportValue = makeExportValue(field);
      }
      if (typeof out.valueGetter !== "function") {
        out.valueGetter = (p) => p?.row?.[field];
      }
      return out;
    });
}

/**
 * SmartAutoGrid
 *  - rows
 *  - headerMap/order/hide/overrides
 *  - actionsColumn
 *  - columnsCompat? (legacy columns array)
 *  - forceHide?: string[]  // hard-remove columns no matter what
 *  - showToolbar? = true
 *  - getRowId?
 */
export default function SmartAutoGrid({
  rows = [],
  headerMap,
  order,
  hide = [],
  overrides,
  forceHide = [],
  actionsColumn,
  columnsCompat,
  showToolbar = true,
  getRowId,
  ...rest
}) {
  const autoCols = useAutoColumns(rows, { headerMap, order, hide, overrides, forceHide });
  const compatCols = useMemo(() => sanitizeCompatColumns(columnsCompat, forceHide), [columnsCompat, forceHide]);

  let columns = columnsCompat ? compatCols : autoCols;
  if (actionsColumn && !columns.find((c) => c.field === actionsColumn.field)) {
    columns = [...columns, actionsColumn];
  }

  const stableGetRowId =
    getRowId ||
    ((row) => row?.id ?? row?.uid ?? row?._id ?? String(row?.docId ?? row?.key ?? ""));

  return (
    <DataGridPro
      rows={rows}
      columns={columns}
      getRowId={stableGetRowId}
      // Density is configurable by the toolbar; this is just the initial value.
      density="compact"
      disableRowSelectionOnClick
      checkboxSelection={false}
      autoHeight
      pagination
      pageSizeOptions={[25, 50, 100]}
      slots={showToolbar ? { toolbar: GridToolbar } : undefined}
      slotProps={
        showToolbar
          ? { toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } } }
          : undefined
      }
      {...rest}
    />
  );
}
