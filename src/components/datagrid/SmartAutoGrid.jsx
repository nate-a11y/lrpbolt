/* Proprietary and confidential. See LICENSE. */
import { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Box } from "@mui/material";
import { DataGridPro, GridToolbar, gridClasses } from "@mui/x-data-grid-pro";

import { toArraySelection, safeGetRowId } from "@/utils/gridSelection";
import SafeGridFooter from "@/components/datagrid/SafeGridFooter.jsx";

import {
  stringifyCell,
  isFsTimestamp,
  formatTs,
  minutesToHuman,
  diffMinutes,
  DEFAULT_TZ,
  toV8Model,
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
          if (!raw) return "N/A";
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
          return dm == null ? "N/A" : minutesToHuman(dm);
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
        if (raw == null) return "N/A";
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
    slotProps,
    slots,
    showToolbar = true,
    autoColumns = true,
    autoHideKeys = [],
    forceHide = [],
    autoPreferredOrder = [],
    hideFooterSelectedRowCount = false,
    ...rest
  } = props;

  const safeRows = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const dataHasRows = safeRows.length > 0;

  const explicitCols = useMemo(
    () => (Array.isArray(columns) ? columns : []),
    [columns],
  );
  const hideKeys = useMemo(
    () => [
      ...(Array.isArray(autoHideKeys) ? autoHideKeys : []),
      ...(Array.isArray(forceHide) ? forceHide : []),
    ],
    [autoHideKeys, forceHide],
  );

  const autoCols = useMemo(() => {
    if (!autoColumns || explicitCols.length > 0 || !dataHasRows) return [];
    return buildAutoColumns(safeRows[0], {
      hideKeys,
      preferredOrder: autoPreferredOrder,
    });
  }, [
    autoColumns,
    explicitCols.length,
    dataHasRows,
    safeRows,
    hideKeys,
    autoPreferredOrder,
  ]);

  const safeCols = useMemo(
    () => (explicitCols.length > 0 ? explicitCols : autoCols),
    [explicitCols, autoCols],
  );

  const rowIdFn = useCallback(
    (row) =>
      typeof getRowId === "function" ? getRowId(row) : safeGetRowId(row),
    [getRowId],
  );

  const [internalRsm, setInternalRsm] = useState([]);
  const controlledRsm =
    rowSelectionModel != null
      ? toArraySelection(rowSelectionModel)
      : internalRsm;

  const handleRsmChange = useCallback(
    (model) => {
      const next = toArraySelection(model);
      setInternalRsm(next);
      if (typeof onRowSelectionModelChange === "function")
        onRowSelectionModelChange(next);
    },
    [onRowSelectionModelChange],
  );

  const v8Selection = useMemo(() => toV8Model(controlledRsm), [controlledRsm]);

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

  const mergedSlotProps = useMemo(
    () => ({
      toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } },
      ...(slotProps || {}),
    }),
    [slotProps],
  );

  const mergedSlots = useMemo(
    () => ({
      footer: SafeGridFooter,
      ...(showToolbar ? { toolbar: GridToolbar } : {}),
      ...(slots || {}),
    }),
    [slots, showToolbar],
  );

  return (
    <Box sx={{ height: "100%", width: "100%" }}>
      <DataGridPro
        rows={safeRows}
        columns={safeCols}
        getRowId={rowIdFn}
        checkboxSelection={checkboxSelection}
        disableRowSelectionOnClick={disableRowSelectionOnClick}
        rowSelectionModel={v8Selection}
        onRowSelectionModelChange={handleRsmChange}
        initialState={safeInitialState}
        columnVisibilityModel={columnVisibilityModel}
        pagination
        autoHeight={rest.autoHeight ?? false}
        density={rest.density ?? "compact"}
        slots={mergedSlots}
        hideFooterSelectedRowCount={hideFooterSelectedRowCount}
        slotProps={mergedSlotProps}
        sx={{
          [`& .${gridClasses.cell}`]: { outline: "none" },
          ...(rest.sx || {}),
        }}
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
  rowSelectionModel: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
  onRowSelectionModelChange: PropTypes.func,
  initialState: PropTypes.object,
  columnVisibilityModel: PropTypes.object,
  slotProps: PropTypes.object,
  slots: PropTypes.object,
  showToolbar: PropTypes.bool,
  autoColumns: PropTypes.bool,
  autoHideKeys: PropTypes.array,
  forceHide: PropTypes.array,
  autoPreferredOrder: PropTypes.array,
  hideFooterSelectedRowCount: PropTypes.bool,
};
