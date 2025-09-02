/* Proprietary and confidential. See LICENSE. */
import { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { DataGridPro, gridClasses, GridToolbar } from "@mui/x-data-grid-pro";

import useIsMobile from "@/hooks/useIsMobile.js";
import SafeGridFooter from "@/components/datagrid/SafeGridFooter.jsx";
import { toArraySelection, safeGetRowId } from "@/utils/gridSelection";

import ResponsiveScrollBox from "./ResponsiveScrollBox.jsx";
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
    columnsCompat,
    headerMap,
    order,
    hide,
    getRowId,
    checkboxSelection = false,
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
    actionsColumn,
    hideFooterSelectedRowCount = false,
    ...rest
  } = props;

  const { isMdDown } = useIsMobile();

  const safeRows = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const dataHasRows = safeRows.length > 0;

  const explicitCols = useMemo(() => {
    if (Array.isArray(columns) && columns.length > 0) return columns;
    if (Array.isArray(columnsCompat) && columnsCompat.length > 0)
      return columnsCompat;
    return [];
  }, [columns, columnsCompat]);

  const hideKeys = useMemo(
    () => [
      ...(Array.isArray(autoHideKeys) ? autoHideKeys : []),
      ...(Array.isArray(hide) ? hide : []),
      ...(Array.isArray(forceHide) ? forceHide : []),
    ],
    [autoHideKeys, hide, forceHide],
  );

  const preferredOrder = useMemo(
    () => order || autoPreferredOrder,
    [order, autoPreferredOrder],
  );

  const autoCols = useMemo(() => {
    if (!autoColumns || explicitCols.length > 0 || !dataHasRows) return [];
    return buildAutoColumns(safeRows[0], {
      hideKeys,
      preferredOrder,
    });
  }, [
    autoColumns,
    explicitCols.length,
    dataHasRows,
    safeRows,
    hideKeys,
    preferredOrder,
  ]);

  const baseCols = useMemo(
    () => (explicitCols.length > 0 ? explicitCols : autoCols),
    [explicitCols, autoCols],
  );

  const mappedCols = useMemo(() => {
    if (!headerMap) return baseCols;
    return baseCols.map((c) => ({
      ...c,
      headerName: headerMap[c.field] || c.headerName,
    }));
  }, [baseCols, headerMap]);

  const safeCols = useMemo(
    () => (actionsColumn ? [...mappedCols, actionsColumn] : mappedCols),
    [mappedCols, actionsColumn],
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

  const mergedSlots = useMemo(() => {
    const base = {
      footer: SafeGridFooter,
      ...(showToolbar ? { toolbar: GridToolbar } : { toolbar: null }),
    };
    return { ...base, ...(slots || {}) };
  }, [slots, showToolbar]);

  const mergedSlotProps = useMemo(
    () => ({
      toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 500 } },
      ...(slotProps || {}),
    }),
    [slotProps],
  );

  const autoHeight = isMdDown ? true : (rest.autoHeight ?? false);
  const density = isMdDown ? "compact" : (rest.density ?? "compact");

  return (
    <ResponsiveScrollBox sx={{ width: "100%", maxWidth: "100%" }}>
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
        autoHeight={autoHeight}
        density={density}
        slots={mergedSlots}
        hideFooterSelectedRowCount={hideFooterSelectedRowCount}
        slotProps={mergedSlotProps}
        sx={{
          [`& .${gridClasses.cell}`]: { outline: "none" },
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          ...(rest.sx || {}),
        }}
        {...rest}
      />
    </ResponsiveScrollBox>
  );
}

SmartAutoGrid.propTypes = {
  rows: PropTypes.array,
  columns: PropTypes.array,
  columnsCompat: PropTypes.array,
  headerMap: PropTypes.object,
  order: PropTypes.array,
  hide: PropTypes.array,
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
  actionsColumn: PropTypes.object,
  hideFooterSelectedRowCount: PropTypes.bool,
};
