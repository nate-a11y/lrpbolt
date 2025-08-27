/* Proprietary and confidential. See LICENSE. */
import React, { useMemo } from "react";
import { DataGridPro } from "@mui/x-data-grid-pro";

import { vfText, vfTime, vfNumber, vfBool } from "../../utils/vf";
import { timestampSortComparator } from "../../utils/timeUtils";

// type guards
const isFsTimestamp = (v) => !!v && typeof v?.toDate === "function";
const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
const isBool = (v) => typeof v === "boolean";

// heuristic width
const widthFor = (field, sample) => {
  if (isFsTimestamp(sample)) return 200;
  if (isNumber(sample)) return 120;
  if (isBool(sample)) return 110;
  if ((field || "").toLowerCase().includes("id")) return 140;
  return 180;
};

// single column builder with safe formatter/sorter
function buildCol(field, headerName, sampleValue) {
  const base = { field, headerName: headerName || field, width: widthFor(field, sampleValue) };

  if (isFsTimestamp(sampleValue)) {
    return { ...base, valueFormatter: vfTime, sortComparator: timestampSortComparator };
  }
  if (isNumber(sampleValue)) {
    return { ...base, valueFormatter: vfNumber };
  }
  if (isBool(sampleValue)) {
    return { ...base, valueFormatter: vfBool };
  }
  return { ...base, valueFormatter: vfText };
}

/**
 * @param {Array<Object>} rows
 * @param {{headerMap?:Record<string,string>, order?:string[], hide?:string[], overrides?:Record<string,Partial<import('@mui/x-data-grid-pro').GridColDef>>}} opts
 */
function useAutoColumns(rows, opts = {}) {
  const { headerMap = {}, order = [], hide = [], overrides = {} } = opts;

  return useMemo(() => {
    const first = rows?.find(Boolean) || {};
    const fields = Object.keys(first);

    // order preference first, then the rest
    const seen = new Set();
    const ordered = [
      ...order.filter((f) => fields.includes(f)).map((f) => (seen.add(f), f)),
      ...fields.filter((f) => !seen.has(f)),
    ];

    const cols = ordered.map((field) => {
      const sample = first[field];
      const col = buildCol(field, headerMap[field], sample);
      if (hide.includes(field)) col.hide = true;
      if (overrides[field]) Object.assign(col, overrides[field]);
      return col;
    });

    return cols;
  }, [rows, headerMap, order, hide, overrides]);
}

/**
 * SmartAutoGrid
 * Props:
 *  - rows (required): raw Firestore rows, each with stable id
 *  - headerMap?: map field -> header text
 *  - order?: preferred field order
 *  - hide?: fields to start hidden
 *  - overrides?: field -> partial GridColDef (e.g., custom width, renderCell)
 *  - getRowId?: stable fallback builder otherwise
 *  - actionsColumn?: a GridColDef to append (e.g., buildNativeActionsColumn(...))
 *  - ...any DataGridPro props
 */
export default function SmartAutoGrid({
  rows = [],
  headerMap,
  order,
  hide,
  overrides,
  getRowId,
  actionsColumn,
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
      {...rest}
    />
  );
}
