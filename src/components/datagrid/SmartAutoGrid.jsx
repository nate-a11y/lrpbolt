/* Proprietary and confidential. See LICENSE. */
import { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Box } from "@mui/material";
import { DataGridPro, useGridApiRef } from "@mui/x-data-grid-pro";

import {
  stringifyCell,
  isFsTimestamp,
  formatTs,
  minutesToHuman,
  diffMinutes,
  DEFAULT_TZ,
} from "./selectionV8";

function headerFromKey(k) {
  if (!k) return "";
  return String(k)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (s) => s.toUpperCase());
}

// Heuristic predicates
const TIME_KEY_RE =
  /(start.?time|end.?time|created.?at|updated.?at|timestamp|time)$/i;
const DURATION_KEY_RE = /(duration|mins?|minutes)$/i;

// Auto-column builder with Central time + human duration
function buildAutoColumns(sampleRow, opts = {}) {
  const { hideKeys = [], preferredOrder = [] } = opts;
  const keys = Object.keys(sampleRow || {}).filter(
    (k) => !hideKeys.includes(k),
  );

  const ordered = [
    ...preferredOrder.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !preferredOrder.includes(k)),
  ];

  return ordered.map((field) => {
    // Timestamp-like
    if (TIME_KEY_RE.test(field)) {
      return {
        field,
        headerName: headerFromKey(field),
        minWidth: 170,
        flex: 1,
        valueGetter: (value, row) => {
          const raw = value ?? row?.[field];
          if (!raw) return "";
          // Handle FS Timestamp or ISOish strings
          return formatTs(raw, "MMM D, h:mm a", DEFAULT_TZ); // e.g., Aug 24, 12:30 pm
        },
      };
    }

    // Duration-like (assume minutes; compute from start/end if missing)
    if (DURATION_KEY_RE.test(field)) {
      return {
        field,
        headerName: headerFromKey(field),
        minWidth: 130,
        flex: 0.7,
        valueGetter: (value, row) => {
          const raw = value ?? row?.[field];
          const asNum = Number(raw);
          if (Number.isFinite(asNum) && asNum >= 0)
            return minutesToHuman(asNum);
          const dm = diffMinutes(
            row?.startTime ?? row?.start_time,
            row?.endTime ?? row?.end_time,
            DEFAULT_TZ,
          );
          return dm == null ? "" : minutesToHuman(dm);
        },
      };
    }

    // Generic column
    return {
      field,
      headerName: headerFromKey(field),
      minWidth: 140,
      flex: 1,
      valueGetter: (value, row) => {
        const raw = value ?? row?.[field];
        if (raw == null) return "";
        if (isFsTimestamp(raw))
          return formatTs(raw, "MMM D, h:mm a", DEFAULT_TZ);
        if (typeof raw === "object") return stringifyCell(raw);
        return raw;
      },
    };
  });
}

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
    autoColumns = true,
    autoHideKeys = [],
    autoPreferredOrder = [],
    ...rest
  } = props;

  const apiRef = useGridApiRef();

  const safeRows = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const dataHasRows = safeRows.length > 0;

  const explicitCols = useMemo(
    () => (Array.isArray(columns) ? columns : []),
    [columns],
  );
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

  const safeCols = useMemo(
    () => (explicitCols.length > 0 ? explicitCols : autoCols),
    [explicitCols, autoCols],
  );

  const safeGetRowId = useCallback(
    (row) => {
      try {
        if (typeof getRowId === "function") return getRowId(row);
        if (row && (row.id || row.uid || row._id))
          return row.id ?? row.uid ?? row._id;
      } catch (err) {
        console.warn("getRowId error; falling back to JSON key", err);
      }
      return JSON.stringify(row);
    },
    [getRowId],
  );

  const [internalRsm, setInternalRsm] = useState([]);
  const controlledRsm =
    rowSelectionModel !== undefined
      ? Array.isArray(rowSelectionModel)
        ? rowSelectionModel
        : []
      : internalRsm;

  const handleRsmChange = useCallback(
    (next) => {
      const clean = Array.isArray(next) ? next : [];
      setInternalRsm(clean);
      if (typeof onRowSelectionModelChange === "function")
        onRowSelectionModelChange(clean);
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
  rowSelectionModel: PropTypes.array,
  onRowSelectionModelChange: PropTypes.func,
  initialState: PropTypes.object,
  columnVisibilityModel: PropTypes.object,
  autoColumns: PropTypes.bool,
  autoHideKeys: PropTypes.array,
  autoPreferredOrder: PropTypes.array,
};
