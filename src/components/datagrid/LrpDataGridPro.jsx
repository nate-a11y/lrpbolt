/* LRP Portal enhancement: DataGrid wrapper, 2025-10-03.
   Rationale: unify defaults, performance, persistence, accessibility.
   FIX: remove blanket valueGetter; columns now render their real values. Use `naFallback: true` per-column to show "N/A" for nulls. */
import React, {
  memo,
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
} from "react";
import PropTypes from "prop-types";
import { Box, Button, Tooltip } from "@mui/material";
import {
  DataGridPro,
  GridToolbarContainer,
  GridToolbarQuickFilter,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarExport,
  useGridApiContext,
} from "@mui/x-data-grid-pro";

import logError from "@/utils/logError.js";
import { getFlag } from "@/services/observability";
import { tsToDayjs } from "@/utils/timeUtils.js";

// ---------- Ride cell rescue helpers (for queue/live/claimed) ----------
const RIDE_GRID_IDS = ["queue-grid", "live-grid", "claimed-grid"];
const RIDE_DATE_FIELDS = new Set(["pickupTime", "createdAt", "claimedAt"]);

function resolveRideField(row, field) {
  const raw = row?._raw || row || {};
  switch (field) {
    case "tripId":
      return (
        row?.tripId ??
        raw.tripId ??
        raw.tripID ??
        raw.rideId ??
        raw.trip ??
        null
      );
    case "pickupTime":
      return (
        row?.pickupTime ?? raw.pickupTime ?? raw.pickupAt ?? raw.pickup ?? null
      );
    case "rideDuration":
      if (typeof row?.rideDuration === "number") return row.rideDuration;
      if (typeof raw.rideDuration === "number") return raw.rideDuration;
      return null;
    case "rideType":
      return row?.rideType ?? raw.rideType ?? null;
    case "vehicle":
      return row?.vehicle ?? raw.vehicle ?? null;
    case "rideNotes":
      return row?.rideNotes ?? raw.rideNotes ?? null;
    case "createdAt":
      return row?.createdAt ?? raw.createdAt ?? null;
    case "claimedBy":
      return row?.claimedBy ?? raw.claimedBy ?? raw.ClaimedBy ?? null;
    case "claimedAt":
      return row?.claimedAt ?? raw.claimedAt ?? raw.ClaimedAt ?? null;
    default:
      return row?.[field] ?? raw[field] ?? null;
  }
}

function formatRideDate(value) {
  const d = tsToDayjs(value);
  if (!d) return "—";
  try {
    return d.format("MMM D, h:mm A");
  } catch (error) {
    logError(error, { where: "LrpDataGridPro.formatRideDate" });
    return "—";
  }
}

function formatRideText(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
}

function formatRideDuration(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "—";
}

function augmentRideColumn(column) {
  if (!column || typeof column !== "object") {
    return column;
  }
  if (typeof column.renderCell === "function") {
    return column;
  }

  const next = { ...column };

  if (RIDE_DATE_FIELDS.has(next.field) && !next.sortComparator) {
    next.sortComparator = (v1, v2, params1, params2) => {
      const first = tsToDayjs(resolveRideField(params1?.row, next.field));
      const second = tsToDayjs(resolveRideField(params2?.row, next.field));
      const a = first ? first.valueOf() : -Infinity;
      const b = second ? second.valueOf() : -Infinity;
      if (a === b) return 0;
      return a < b ? -1 : 1;
    };
  }

  next.renderCell = (params) => {
    const value = resolveRideField(params?.row, next.field);
    if (RIDE_DATE_FIELDS.has(next.field)) {
      return formatRideDate(value);
    }
    if (next.field === "rideDuration") {
      return formatRideDuration(value);
    }
    return formatRideText(value);
  };

  return next;
}

function maybeAugmentColumnsForRides(columns, gridId) {
  if (!Array.isArray(columns) || !RIDE_GRID_IDS.includes(gridId)) {
    return columns;
  }
  let changed = false;
  const augmented = columns.map((col) => {
    const next = augmentRideColumn(col);
    if (next !== col) {
      changed = true;
    }
    return next;
  });
  return changed ? augmented : columns;
}

const QUICK_FILTER_PARSER = (value) =>
  String(value || "")
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

/* FIX: persist density as string so GridToolbarDensitySelector can update state */
/** Persist per-grid state (column visibility, density, filters) in localStorage */
function useGridStatePersistence(id, defaults = {}) {
  const storageKey = useMemo(() => {
    if (!id) return null;
    return `lrp:grid:${id}`;
  }, [id]);

  const initialState = useMemo(() => {
    const fallback = {
      density: defaults?.density || "compact",
      columnVisibilityModel: defaults?.columnVisibilityModel || {},
      filterModel: defaults?.filterModel || null,
    };

    if (!storageKey || !isBrowser()) {
      return fallback;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return fallback;
      }
      const parsed = JSON.parse(raw);
      let savedDensity = parsed?.density;
      if (typeof savedDensity === "object" && savedDensity?.value) {
        savedDensity = savedDensity.value;
      }
      if (typeof savedDensity !== "string") {
        savedDensity = undefined;
      }
      return {
        density: savedDensity || fallback.density,
        columnVisibilityModel:
          parsed?.columnVisibilityModel ||
          defaults?.columnVisibilityModel ||
          {},
        filterModel: parsed?.filterModel || defaults?.filterModel || null,
      };
    } catch (error) {
      logError(error, { where: "LrpDataGridPro.initialState" });
      return fallback;
    }
  }, [
    defaults?.columnVisibilityModel,
    defaults?.density,
    defaults?.filterModel,
    storageKey,
  ]);

  const onStateChange = useCallback(
    (state) => {
      if (!storageKey || !isBrowser()) return;
      try {
        let densityValue = state?.density;
        if (typeof densityValue === "object" && densityValue?.value) {
          densityValue = densityValue.value;
        }
        if (typeof densityValue !== "string") {
          densityValue = undefined;
        }
        const payload = {
          density: densityValue || defaults?.density || "compact",
          columnVisibilityModel: state?.columns?.columnVisibilityModel || {},
          filterModel: state?.filter?.filterModel || null,
        };
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch (error) {
        logError(error, { where: "LrpDataGridPro.onStateChange" });
      }
    },
    [defaults?.density, storageKey],
  );

  return { initialState, onStateChange };
}

function useSelectedRowIds(apiRef) {
  return useCallback(() => {
    try {
      if (!apiRef?.current) return [];
      const selected = apiRef.current.getSelectedRows?.();
      if (selected instanceof Map) return Array.from(selected.keys());
      if (Array.isArray(selected)) return selected;
      if (selected && typeof selected === "object") {
        return Object.keys(selected);
      }
      return [];
    } catch (error) {
      logError(error, { where: "LrpDataGridPro.getSelectedRows" });
      return [];
    }
  }, [apiRef]);
}

const FALLBACK_DISPLAY = "—";

function ensureDisplayValue(value, fallback = FALLBACK_DISPLAY) {
  if (value === null || value === undefined) return fallback;
  if (value === "") return fallback;
  return value;
}

function createSafeRenderCell(field, renderCell) {
  if (renderCell?.$lrpSafeWrapped) {
    return renderCell;
  }

  const safe = (params) => {
    try {
      if (typeof renderCell === "function") {
        return renderCell(params);
      }
      const fallbackValue = params?.formattedValue ?? params?.value;
      return ensureDisplayValue(fallbackValue);
    } catch (error) {
      logError(error, {
        where: "LrpDataGridPro.renderCell",
        field,
      });
      const fallbackValue = params?.formattedValue ?? params?.value;
      return ensureDisplayValue(fallbackValue);
    }
  };
  safe.$lrpSafeWrapped = true;
  return safe;
}

function DefaultToolbar({
  quickFilterPlaceholder,
  onDeleteSelected,
  deleteLabel = "Delete Selected",
  csvOptions,
  disableColumnFilter,
  disableColumnSelector,
  disableDensitySelector,
}) {
  const apiRef = useGridApiContext();
  const getSelectedIds = useSelectedRowIds(apiRef);
  const [selectionCount, setSelectionCount] = useState(0);

  const handleDelete = useCallback(async () => {
    if (typeof onDeleteSelected !== "function") return;
    const ids = getSelectedIds();
    if (!ids.length) return;
    try {
      await onDeleteSelected(ids);
    } catch (error) {
      logError(error, { where: "LrpDataGridPro.toolbarDelete" });
    }
  }, [getSelectedIds, onDeleteSelected]);

  useEffect(() => {
    if (!apiRef?.current) return undefined;

    const updateCount = () => {
      setSelectionCount(getSelectedIds().length);
    };

    updateCount();

    const unsubscribers = [];
    const subscribe = (eventName) => {
      const unsub = apiRef.current.subscribeEvent?.(eventName, updateCount);
      if (typeof unsub === "function") {
        unsubscribers.push(unsub);
      }
    };

    subscribe("rowSelectionChange");
    subscribe("rowSelectionModelChange");

    return () => {
      unsubscribers.forEach((unsub) => {
        try {
          if (typeof unsub === "function") unsub();
        } catch (error) {
          logError(error, { where: "LrpDataGridPro.toolbarCleanup" });
        }
      });
    };
  }, [apiRef, getSelectedIds]);

  return (
    <GridToolbarContainer
      sx={{
        px: 1,
        py: 0.75,
        gap: 1,
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        bgcolor: "rgba(6,6,6,0.92)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        "& .MuiSvgIcon-root": { color: (t) => t.palette.primary.main },
        "& .MuiInputBase-root": {
          minWidth: { xs: "100%", sm: 220 },
          maxWidth: { sm: 260, md: 320 },
        },
      }}
    >
      <GridToolbarQuickFilter
        debounceMs={300}
        quickFilterParser={QUICK_FILTER_PARSER}
        placeholder={quickFilterPlaceholder || "Search…"}
        sx={{ flexGrow: { xs: 1, sm: 0 }, minWidth: { xs: 200, sm: 0 } }}
      />
      <Box sx={{ flexGrow: 1 }} />
      {!disableColumnSelector && <GridToolbarColumnsButton />}
      {!disableColumnFilter && <GridToolbarFilterButton />}
      {!disableDensitySelector && <GridToolbarDensitySelector />}
      <GridToolbarExport
        csvOptions={{
          fileName: csvOptions?.fileName || "export",
          ...csvOptions,
        }}
      />
      {typeof onDeleteSelected === "function" && (
        <Tooltip
          title={
            selectionCount
              ? `Delete ${selectionCount} selected`
              : "Select rows to delete"
          }
        >
          <span>
            <Button
              size="small"
              onClick={handleDelete}
              disabled={!selectionCount}
              sx={{
                ml: 0.5,
                bgcolor: "rgba(76,187,23,0.18)",
                color: "#ffffff",
                "&:hover": {
                  bgcolor: "rgba(76,187,23,0.28)",
                },
              }}
            >
              {deleteLabel}
            </Button>
          </span>
        </Tooltip>
      )}
    </GridToolbarContainer>
  );
}

DefaultToolbar.propTypes = {
  quickFilterPlaceholder: PropTypes.string,
  onDeleteSelected: PropTypes.func,
  deleteLabel: PropTypes.string,
  csvOptions: PropTypes.object,
  disableColumnFilter: PropTypes.bool,
  disableColumnSelector: PropTypes.bool,
  disableDensitySelector: PropTypes.bool,
};

const EmptyOverlay = () => (
  <Box
    role="status"
    aria-live="polite"
    sx={{ p: 3, textAlign: "center", color: "text.secondary" }}
  >
    No rows to display.
  </Box>
);

const ErrorOverlay = ({ message }) => (
  <Box
    role="alert"
    sx={{
      p: 3,
      textAlign: "center",
      color: "error.main",
      whiteSpace: "pre-wrap",
    }}
  >
    {message || "Something went wrong loading the grid."}
  </Box>
);

ErrorOverlay.propTypes = {
  message: PropTypes.string,
};

/** LrpDataGridPro: unified defaults; pass through everything else */
function LrpDataGridPro({
  id,
  rows,
  columns,
  getRowId,
  density = "compact",
  autoHeight = true,
  disableColumnFilter = false,
  disableColumnSelector = false,
  disableDensitySelector = false,
  slots,
  slotProps,
  quickFilterPlaceholder,
  error,
  onStateChange: onStateChangeProp,
  initialState: initialStateProp,
  checkboxSelection = false,
  disableRowSelectionOnClick = true,
  ...rest
}) {
  const missingIdWarnedRef = useRef(false);
  const defaults = useMemo(
    () => ({
      density,
      columnVisibilityModel:
        initialStateProp?.columns?.columnVisibilityModel || {},
      filterModel: initialStateProp?.filter?.filterModel || null,
    }),
    [
      density,
      initialStateProp?.columns?.columnVisibilityModel,
      initialStateProp?.filter?.filterModel,
    ],
  );

  const { initialState: persistedState, onStateChange: persistState } =
    useGridStatePersistence(id, defaults);

  const mergedGetRowId = useCallback(
    (row) => {
      if (typeof getRowId === "function") {
        return getRowId(row);
      }
      const fallbackId = row?.id ?? row?.docId ?? row?.uid ?? undefined;
      if (
        fallbackId == null &&
        typeof import.meta !== "undefined" &&
        import.meta.env?.DEV &&
        !missingIdWarnedRef.current
      ) {
        missingIdWarnedRef.current = true;
        console.warn("[LrpDataGridPro] Missing row id", { gridId: id });
      }
      return fallbackId;
    },
    [getRowId, id],
  );

  const rideAwareColumns = useMemo(() => {
    return maybeAugmentColumnsForRides(columns, id);
  }, [columns, id]);

  const safeColumns = useMemo(() => {
    return (rideAwareColumns || []).map((col) => {
      if (!col) return col;

      let next = col;

      if (typeof col.renderCell === "function") {
        const wrapped = createSafeRenderCell(col.field, col.renderCell);
        if (wrapped !== col.renderCell) {
          next = { ...next, renderCell: wrapped };
        }
      }

      if (
        typeof next.valueGetter === "function" ||
        typeof next.valueFormatter === "function"
      ) {
        return next;
      }

      if (next.naFallback) {
        const formatter = (params) => {
          const value = params?.value;
          return ensureDisplayValue(value, "N/A");
        };
        return { ...next, valueFormatter: formatter };
      }

      return next;
    });
  }, [rideAwareColumns]);

  useEffect(() => {
    if (typeof import.meta === "undefined" || import.meta.env?.PROD) {
      return;
    }
    if (!["queue-grid", "live-grid", "claimed-grid"].includes(id)) {
      return;
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return;
    }
    const firstRow = rows[0];
    const raw = firstRow?._raw || {};
    console.log("[GridProbe]", id, {
      firstRowKeys: Object.keys(firstRow || {}),
      id: firstRow?.id ?? null,
      tripId:
        firstRow?.tripId ??
        raw?.tripId ??
        raw?.tripID ??
        raw?.rideId ??
        raw?.trip ??
        null,
      pickupTimeType: typeof firstRow?.pickupTime,
      pickupTimeRaw: raw?.pickupTime ?? raw?.pickupAt ?? raw?.pickup ?? null,
    });
  }, [id, rows]);

  useEffect(() => {
    if (!getFlag || !getFlag("grid.debug")) {
      return;
    }
    const sampleRow = Array.isArray(rows) ? rows[0] : null;
    const columnFields = (rideAwareColumns || [])
      .map((c) => (c ? c.field : null))
      .filter(Boolean);
    console.log("[GridDebug]", {
      id,
      sampleRow,
      columns: columnFields,
    });
  }, [id, rows, rideAwareColumns]);

  const mergedSlots = useMemo(
    () => ({
      toolbar: DefaultToolbar,
      noRowsOverlay: EmptyOverlay,
      errorOverlay: ErrorOverlay,
      ...(slots || {}),
    }),
    [slots],
  );

  const mergedSlotProps = useMemo(() => {
    const toolbarProps = {
      quickFilterPlaceholder,
      disableColumnFilter,
      disableColumnSelector,
      disableDensitySelector,
      ...(slotProps?.toolbar || {}),
    };
    const errorOverlayProps = {
      message: error?.message,
      ...(slotProps?.errorOverlay || {}),
    };

    return {
      ...(slotProps || {}),
      toolbar: toolbarProps,
      errorOverlay: errorOverlayProps,
    };
  }, [
    disableColumnFilter,
    disableColumnSelector,
    disableDensitySelector,
    error?.message,
    quickFilterPlaceholder,
    slotProps,
  ]);

  const mergedInitialState = useMemo(() => {
    const base = initialStateProp ? { ...initialStateProp } : {};
    const columnVisibilityModel = {
      ...(initialStateProp?.columns?.columnVisibilityModel || {}),
      ...(persistedState?.columnVisibilityModel || {}),
    };
    if (Object.keys(columnVisibilityModel).length) {
      base.columns = {
        ...(initialStateProp?.columns || {}),
        columnVisibilityModel,
      };
    }
    const filterModel = {
      ...(initialStateProp?.filter?.filterModel || {}),
      ...(persistedState?.filterModel || {}),
    };
    if (Object.keys(filterModel).length) {
      base.filter = {
        ...(initialStateProp?.filter || {}),
        filterModel,
      };
    }
    return base;
  }, [
    initialStateProp,
    persistedState?.columnVisibilityModel,
    persistedState?.filterModel,
  ]);

  const resolvedDensity = persistedState?.density || density;

  const handleStateChange = useCallback(
    (state, event) => {
      persistState(state);
      if (typeof onStateChangeProp === "function") {
        onStateChangeProp(state, event);
      }
    },
    [onStateChangeProp, persistState],
  );

  return (
    <DataGridPro
      rows={Array.isArray(rows) ? rows : []}
      columns={safeColumns}
      getRowId={mergedGetRowId}
      density={resolvedDensity}
      autoHeight={autoHeight}
      checkboxSelection={checkboxSelection}
      disableRowSelectionOnClick={disableRowSelectionOnClick}
      disableColumnFilter={disableColumnFilter}
      disableColumnSelector={disableColumnSelector}
      disableDensitySelector={disableDensitySelector}
      sortingOrder={["desc", "asc"]}
      initialState={mergedInitialState}
      onStateChange={handleStateChange}
      slots={mergedSlots}
      slotProps={mergedSlotProps}
      experimentalFeatures={{ ariaV7: true }}
      error={error}
      sx={(t) => ({
        "& .MuiDataGrid-toolbarContainer": {
          backgroundColor: t.palette.background.paper,
          borderBottom: `1px solid ${t.palette.divider}`,
        },
        "& .MuiDataGrid-columnHeaders": {
          backgroundColor: t.palette.background.paper,
          borderBottom: `1px solid ${t.palette.divider}`,
        },
        "& .MuiDataGrid-virtualScroller, & .MuiDataGrid-virtualScrollerContent, & .MuiDataGrid-footerContainer":
          {
            backgroundColor: t.palette.background.paper,
          },
      })}
      {...rest}
    />
  );
}

LrpDataGridPro.propTypes = {
  id: PropTypes.string,
  rows: PropTypes.array,
  columns: PropTypes.array.isRequired,
  getRowId: PropTypes.func,
  density: PropTypes.oneOf(["compact", "standard", "comfortable"]),
  autoHeight: PropTypes.bool,
  disableColumnFilter: PropTypes.bool,
  disableColumnSelector: PropTypes.bool,
  disableDensitySelector: PropTypes.bool,
  slots: PropTypes.object,
  slotProps: PropTypes.object,
  quickFilterPlaceholder: PropTypes.string,
  error: PropTypes.object,
  initialState: PropTypes.object,
  checkboxSelection: PropTypes.bool,
  disableRowSelectionOnClick: PropTypes.bool,
  onStateChange: PropTypes.func,
};

export default memo(LrpDataGridPro);
