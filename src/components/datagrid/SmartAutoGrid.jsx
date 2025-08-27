/* Proprietary and confidential. See LICENSE. */
import React, { useMemo } from "react";
import { DataGridPro, GridToolbar } from "@mui/x-data-grid-pro";

import { vfText, vfTime, vfNumber, vfBool, vfDurationHM } from "../../utils/vf";
import { timestampSortComparator } from "../../utils/timeUtils";

const isFsTimestamp = (v) => !!v && typeof v?.toDate === "function";
const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
const isBool = (v) => typeof v === "boolean";
const isPlainObject = (v) => v && typeof v === "object" && !isFsTimestamp(v) && !Array.isArray(v);

const looksLikeDurationField = (field = "") =>
  ["duration", "durationmins", "rideduration", "totalminutes"].includes(field.toLowerCase());

const widthFor = (field, sample) => {
  if (isFsTimestamp(sample)) return 200;
  if (looksLikeDurationField(field)) return 120;
  if (isNumber(sample)) return 120;
  if (isBool(sample)) return 110;
  if ((field || "").toLowerCase().includes("id")) return 140;
  return 180;
};

// valueGetter that neutralizes objects -> null (prevents [object Object])
const safeGetter = (field) => (params) => {
  const v = params?.row?.[field];
  if (isPlainObject(v)) return null;
  return v;
};

function buildCol(field, headerName, sampleValue) {
  const base = {
    field,
    headerName: headerName || field,
    width: widthFor(field, sampleValue),
    valueGetter: safeGetter(field), // <- guard
  };

  if (looksLikeDurationField(field)) return { ...base, valueFormatter: vfDurationHM };
  if (isFsTimestamp(sampleValue)) return { ...base, valueFormatter: vfTime, sortComparator: timestampSortComparator };
  if (isNumber(sampleValue))     return { ...base, valueFormatter: vfNumber };
  if (isBool(sampleValue))       return { ...base, valueFormatter: vfBool };
  return { ...base, valueFormatter: vfText };
}

function useAutoColumns(rows, opts = {}) {
  const { headerMap = {}, order = [], hide = [], overrides = {} } = opts;

  return useMemo(() => {
    const first = rows?.find(Boolean) || {};
    const fields = Object.keys(first);

    const seen = new Set();
    const ordered = [
      ...order.filter((f) => fields.includes(f)).map((f) => (seen.add(f), f)),
      ...fields.filter((f) => !seen.has(f)),
    ];

    return ordered.map((field) => {
      const sample = first[field];
      const col = buildCol(field, headerMap[field], sample);
      if (hide.includes(field)) col.hide = true;
      if (overrides[field]) Object.assign(col, overrides[field]);
      return col;
    });
  }, [rows, headerMap, order, hide, overrides]);
}

/**
 * SmartAutoGrid
 *  - rows: array of normalized rows ({id,...})
 *  - headerMap/order/hide/overrides
 *  - actionsColumn?: GridColDef appended if provided
 *  - showToolbar?: true by default
 */
export default function SmartAutoGrid({
  rows = [],
  headerMap,
  order,
  hide = [],
  overrides,
  getRowId,
  actionsColumn,
  showToolbar = true,
  ...rest
}) {
  const columns = useAutoColumns(rows, { headerMap, order, hide, overrides });

  const finalCols = React.useMemo(() => {
    if (actionsColumn && !columns.find((c) => c.field === actionsColumn.field)) {
      return [...columns, actionsColumn];
    }
    return columns;
  }, [columns, actionsColumn]);

  const stableGetRowId =
    getRowId ||
    ((row) => row?.id ?? row?.uid ?? row?._id ?? String(row?.docId ?? row?.key ?? ""));

  return (
    <DataGridPro
      rows={rows}
      columns={finalCols}
      getRowId={stableGetRowId}
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
