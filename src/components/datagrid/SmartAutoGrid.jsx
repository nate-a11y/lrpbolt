/* Proprietary and confidential. See LICENSE. */
import { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { DataGridPro, gridClasses } from "@mui/x-data-grid-pro";
import { alpha } from "@mui/material/styles";

import LrpGridToolbar from "src/components/datagrid/LrpGridToolbar.jsx";
import useIsMobile from "@/hooks/useIsMobile.js";
import SafeGridFooter from "@/components/datagrid/SafeGridFooter.jsx";
import { toArraySelection, safeGetRowId } from "@/utils/gridSelection";
import { timestampSortComparator } from "@/utils/timeUtils.js";

import ResponsiveScrollBox from "./ResponsiveScrollBox.jsx";
import { NoRowsOverlay, ErrorOverlay } from "./DefaultGridOverlays.jsx";
import {
  stringifyCell,
  isFsTimestamp,
  formatTs,
  minutesToHuman,
  diffMinutes,
  DEFAULT_TZ,
} from "./selectionV8";

const MAX_VISIBLE_ROWS = 15;
const DEFAULT_MIN_HEIGHT = { xs: 320, sm: 360, md: 420 };
const DEFAULT_FILL_HEIGHT = {
  xs: "calc(100vh - 240px)",
  sm: "calc(100vh - 260px)",
  md: "calc(100vh - 320px)",
  lg: "calc(100vh - 360px)",
};

function mergeResponsive(defaultValue, override) {
  if (override == null) return defaultValue;
  if (typeof override === "number" || typeof override === "string") {
    return override;
  }
  if (typeof override === "object" && !Array.isArray(override)) {
    return { ...defaultValue, ...override };
  }
  return defaultValue;
}

function mergeSx(base, override) {
  if (!override) return base;
  if (Array.isArray(override)) {
    return [base, ...override];
  }
  if (typeof override === "function") {
    return (theme) => ({ ...base, ...override(theme) });
  }
  return { ...base, ...override };
}

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
        sortComparator: (v1, v2, p1, p2) =>
          timestampSortComparator(p1?.row?.[field], p2?.row?.[field]),
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
          if (Number.isFinite(asNum) && asNum > 0) return minutesToHuman(asNum);
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
    apiRef,
    initialState,
    columnVisibilityModel,
    slotProps,
    slots,
    components,
    componentsProps,
    autoColumns = true,
    autoHideKeys = [],
    forceHide = [],
    autoPreferredOrder = [],
    actionsColumn,
    overrides,
    hideFooterSelectedRowCount = false,
    pageSizeOptions = [
      MAX_VISIBLE_ROWS,
      MAX_VISIBLE_ROWS * 2,
      MAX_VISIBLE_ROWS * 4,
    ],
    minHeight: minHeightProp,
    gridHeight,
    autoHeight: autoHeightProp,
    containerSx,
    sx: gridSxProp,
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

  const overriddenCols = useMemo(() => {
    if (!overrides) return mappedCols;
    return mappedCols.map((c) => ({ ...c, ...(overrides[c.field] || {}) }));
  }, [mappedCols, overrides]);

  const safeCols = useMemo(
    () => (actionsColumn ? [...overriddenCols, actionsColumn] : overriddenCols),
    [overriddenCols, actionsColumn],
  );

  const responsiveCols = useMemo(() => {
    if (!isMdDown) return safeCols;
    return safeCols.map((c) => ({
      ...c,
      minWidth: c.minWidth ? Math.min(c.minWidth, 100) : 100,
      flex: c.flex ?? 1,
    }));
  }, [safeCols, isMdDown]);

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

  const safeInitialState = useMemo(() => {
    const base = {
      density: "compact",
      pagination: { paginationModel: { pageSize: MAX_VISIBLE_ROWS, page: 0 } },
      filter: { filterModel: { quickFilterValues: [], items: [] } },
    };
    const merged = {
      ...base,
      ...initialState,
      pagination: {
        ...base.pagination,
        ...initialState?.pagination,
        paginationModel: {
          ...base.pagination.paginationModel,
          ...initialState?.pagination?.paginationModel,
        },
      },
      filter: {
        ...base.filter,
        ...initialState?.filter,
        filterModel: {
          ...base.filter.filterModel,
          ...initialState?.filter?.filterModel,
        },
      },
    };
    // Always enforce the default page size
    merged.pagination.paginationModel.pageSize = MAX_VISIBLE_ROWS;
    return merged;
  }, [initialState]);

  const safePageSizeOptions = useMemo(() => {
    const opts = Array.isArray(pageSizeOptions) ? pageSizeOptions : [];
    return [MAX_VISIBLE_ROWS, ...opts.filter((v) => v !== MAX_VISIBLE_ROWS)];
  }, [pageSizeOptions]);

  const mergedSlots = useMemo(
    () => ({
      footer: SafeGridFooter,
      noRowsOverlay: NoRowsOverlay,
      errorOverlay: ErrorOverlay,
      toolbar: LrpGridToolbar,
      ...(slots || {}),
    }),
    [slots],
  );

  const mergedSlotProps = useMemo(
    () => ({
      toolbar: {
        quickFilterPlaceholder: "Search",
        ...slotProps?.toolbar,
        onDeleteSelected:
          typeof slotProps?.toolbar?.onDeleteSelected === "function"
            ? slotProps.toolbar.onDeleteSelected
            : undefined,
      },
      ...slotProps,
    }),
    [slotProps],
  );

  const mergedComponents = useMemo(
    () => ({
      Footer: SafeGridFooter,
      NoRowsOverlay: NoRowsOverlay,
      ErrorOverlay: ErrorOverlay,
      Toolbar: LrpGridToolbar,
      ...(components || {}),
    }),
    [components],
  );

  const mergedComponentsProps = useMemo(
    () => ({
      toolbar: {
        quickFilterPlaceholder: "Search",
        ...componentsProps?.toolbar,
        onDeleteSelected:
          typeof componentsProps?.toolbar?.onDeleteSelected === "function"
            ? componentsProps.toolbar.onDeleteSelected
            : undefined,
      },
      ...componentsProps,
    }),
    [componentsProps],
  );

  const computedAutoHeight = autoHeightProp ?? false;
  const resolvedMinHeight = useMemo(
    () => mergeResponsive(DEFAULT_MIN_HEIGHT, minHeightProp),
    [minHeightProp],
  );
  const resolvedFillHeight = useMemo(
    () => mergeResponsive(DEFAULT_FILL_HEIGHT, gridHeight),
    [gridHeight],
  );

  const scrollBoxSx = useMemo(() => {
    const base = {
      width: "100%",
      maxWidth: "100%",
      minWidth: 0,
    };
    if (computedAutoHeight) {
      if (minHeightProp != null) {
        return { ...base, minHeight: resolvedMinHeight };
      }
      return base;
    }
    return {
      ...base,
      minHeight: resolvedMinHeight,
      height: resolvedFillHeight,
      flexGrow: 1,
    };
  }, [
    computedAutoHeight,
    minHeightProp,
    resolvedFillHeight,
    resolvedMinHeight,
  ]);

  const mergedGridSx = useMemo(() => {
    const base = (theme) => {
      const isDark = theme.palette.mode === "dark";
      const headerBg = isDark
        ? theme.palette.primary.main
        : alpha(theme.palette.primary.main, 0.12);
      const headerColor = isDark
        ? theme.palette.common.white
        : theme.palette.text.primary;

      return {
        [`& .${gridClasses.cell}`]: { outline: "none" },
        "& .MuiDataGrid-columnHeader:focus": { outline: "none" },
        "& .MuiDataGrid-toolbarContainer": {
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          padding: "4px 8px",
          gap: 1,
          position: "sticky",
          top: 0,
          zIndex: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
        },
        "& .MuiDataGrid-columnHeaders": {
          backgroundColor: headerBg,
          color: headerColor,
          borderBottom: `1px solid ${theme.palette.divider}`,
        },
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        ...(computedAutoHeight ? {} : { height: "100%" }),
      };
    };

    if (!gridSxProp) {
      return base;
    }
    if (Array.isArray(gridSxProp)) {
      return [base, ...gridSxProp];
    }
    return [base, gridSxProp];
  }, [computedAutoHeight, gridSxProp]);

  const mergedContainerSx = useMemo(
    () => mergeSx(scrollBoxSx, containerSx),
    [scrollBoxSx, containerSx],
  );

  const density = rest.density ?? "compact";

  return (
    <ResponsiveScrollBox sx={mergedContainerSx}>
      <DataGridPro
        apiRef={apiRef}
        rows={safeRows}
        columns={responsiveCols}
        getRowId={rowIdFn}
        checkboxSelection={checkboxSelection}
        disableRowSelectionOnClick={disableRowSelectionOnClick}
        rowSelectionModel={controlledRsm}
        onRowSelectionModelChange={handleRsmChange}
        initialState={safeInitialState}
        columnVisibilityModel={columnVisibilityModel}
        pagination
        pageSizeOptions={safePageSizeOptions}
        autoHeight={computedAutoHeight}
        density={density}
        slots={mergedSlots}
        slotProps={mergedSlotProps}
        components={mergedComponents}
        componentsProps={mergedComponentsProps}
        hideFooterSelectedRowCount={hideFooterSelectedRowCount}
        sx={mergedGridSx}
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
  apiRef: PropTypes.object,
  initialState: PropTypes.object,
  columnVisibilityModel: PropTypes.object,
  slotProps: PropTypes.object,
  slots: PropTypes.object,
  components: PropTypes.object,
  componentsProps: PropTypes.object,
  autoColumns: PropTypes.bool,
  autoHideKeys: PropTypes.array,
  forceHide: PropTypes.array,
  autoPreferredOrder: PropTypes.array,
  actionsColumn: PropTypes.object,
  overrides: PropTypes.object,
  hideFooterSelectedRowCount: PropTypes.bool,
  pageSizeOptions: PropTypes.array,
  minHeight: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
    PropTypes.object,
  ]),
  gridHeight: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
    PropTypes.object,
  ]),
  autoHeight: PropTypes.bool,
  containerSx: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.array,
    PropTypes.func,
  ]),
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.func]),
};
