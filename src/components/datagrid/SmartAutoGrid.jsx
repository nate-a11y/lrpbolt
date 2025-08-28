/* Proprietary and confidential. See LICENSE. */
import { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Box } from "@mui/material";
import { DataGridPro, useGridApiRef } from "@mui/x-data-grid-pro";

import {
  toV8Model,
  stringifyCell,
  isFsTimestamp,
  formatMaybeTs,
} from "./selectionV8";

// Build a readable header from object key: "startTime" -> "Start Time"
function headerFromKey(k) {
  if (!k) return "";
  return String(k)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (s) => s.toUpperCase());
}

// Heuristic auto-column factory.
// - Skips obvious internal keys if requested
// - Null-safe valueGetter signature for v7/v8: (value, row)
function buildAutoColumns(sampleRow, opts = {}) {
  const { hideKeys = [], preferredOrder = [] } = opts;
  const keys = Object.keys(sampleRow || {}).filter((k) => !hideKeys.includes(k));

  // Put preferred keys first if present
  const ordered = [
    ...preferredOrder.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !preferredOrder.includes(k)),
  ];

  return ordered.map((field) => {
    return {
      field,
      headerName: headerFromKey(field),
      minWidth: 140,
      flex: 1,
      // valueGetter signature in v7+/v8 is (value, row)
      valueGetter: (value, row) => {
        const raw = value ?? row?.[field];
        if (isFsTimestamp(raw)) return formatMaybeTs(raw);
        if (raw == null) return "";
        if (typeof raw === "object") return stringifyCell(raw);
        return raw;
      },
    };
  });
}

/**
 * SmartAutoGrid – shared wrapper with:
 *  - v8-safe row selection model (object with Set)
 *  - Auto-generated columns when none are provided
 *  - Defensive null guards for rows/columns/getRowId
 */
export default function SmartAutoGrid(props) {
  const {
    rows,
    columns,
    getRowId,
    checkboxSelection = true,
    disableRowSelectionOnClick = false,
    rowSelectionModel,
    onRowSelectionModelChange,
    initialState,
    columnVisibilityModel,
    autoColumns = true,                // NEW: enable auto columns by default
    autoHideKeys = [],                 // e.g., ["id", "userEmail", "driverId"]
    autoPreferredOrder = [],           // e.g., ["startTime", "endTime", "duration"]
    ...rest
  } = props;

  const apiRef = useGridApiRef();

  const safeRows = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const dataHasRows = safeRows.length > 0;

  const explicitCols = useMemo(() => (Array.isArray(columns) ? columns : []), [columns]);
  const autoCols = useMemo(() => {
    if (!autoColumns || explicitCols.length > 0 || !dataHasRows) return [];
    return buildAutoColumns(safeRows[0], {
      hideKeys: autoHideKeys,
      preferredOrder: autoPreferredOrder,
    });
  }, [
    autoColumns,
    explicitCols.length,
    dataHasRows,
    safeRows,
    autoHideKeys,
    autoPreferredOrder,
  ]);

  const safeCols = useMemo(() => {
    return explicitCols.length > 0 ? explicitCols : autoCols;
  }, [explicitCols, autoCols]);

  // Stable getRowId
  const safeGetRowId = useCallback(
    (row) => {
      try {
        if (typeof getRowId === "function") return getRowId(row);
        if (row && (row.id || row.uid || row._id)) return row.id ?? row.uid ?? row._id;
      } catch (err) {
        console.warn("getRowId error; falling back to JSON key", err);
      }
      return JSON.stringify(row);
    },
    [getRowId],
  );

  // v8 selection model control
  const [internalRsm, setInternalRsm] = useState({ ids: new Set(), type: "include" });
  const externalNormalized = useMemo(
    () => toV8Model(rowSelectionModel),
    [rowSelectionModel],
  );
  const controlledRsm =
    rowSelectionModel !== undefined ? externalNormalized : internalRsm;

  const handleRsmChange = useCallback(
    (next, details) => {
      const clean = toV8Model(next);
      setInternalRsm(clean);
      if (typeof onRowSelectionModelChange === "function") {
        onRowSelectionModelChange(clean, details);
      }
    },
    [onRowSelectionModelChange],
  );

  const safeInitialState = useMemo(
    () => ({
      density: "compact",
      ...initialState,
      filter: {
        ...initialState?.filter,
        filterModel: {
          quickFilterValues:
            initialState?.filter?.filterModel?.quickFilterValues ?? [],
          items: initialState?.filter?.filterModel?.items ?? [],
        },
      },
    }),
    [initialState],
  );

  return (
    <Box sx={{ height: "100%", width: "100%" }}>
      <DataGridPro
        apiRef={apiRef}
        rows={safeRows}
        columns={safeCols}
        getRowId={safeGetRowId}
        checkboxSelection={checkboxSelection}
        disableRowSelectionOnClick={disableRowSelectionOnClick}
        rowSelectionModel={controlledRsm}
        onRowSelectionModelChange={handleRsmChange}
        initialState={safeInitialState}
        columnVisibilityModel={columnVisibilityModel}
        pagination
        autoHeight={rest.autoHeight ?? false}
        density={rest.density ?? "compact"}
        {...rest}
      />
    </Box>
  );
}

SmartAutoGrid.propTypes = {
  rows: PropTypes.array,
  columns: PropTypes.array,
  getRowId: PropTypes.func,
  checkboxSelection: PropTypes.bool,
  disableRowSelectionOnClick: PropTypes.bool,
  rowSelectionModel: PropTypes.any,
  onRowSelectionModelChange: PropTypes.func,
  initialState: PropTypes.object,
  columnVisibilityModel: PropTypes.object,
  autoColumns: PropTypes.bool,
  autoHideKeys: PropTypes.array,
  autoPreferredOrder: PropTypes.array,
};
