/* Proprietary and confidential. See LICENSE. */
import { useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { DataGridPro } from "@mui/x-data-grid-pro";
import { alpha } from "@mui/material/styles";

import LrpGridToolbar from "./LrpGridToolbar.jsx";
import SafeGridFooter from "./SafeGridFooter.jsx";
import { NoRowsOverlay, ErrorOverlay } from "./DefaultGridOverlays.jsx";

/**
 * UniversalDataGrid - Single source of truth for all DataGrid usage
 *
 * MUI v8 compatible, handles all your Firebase data grids:
 * - Time Logs (Admin Logs, Time Clock)
 * - Tickets (Support, Shuttle)
 * - Users, Shootout Stats, etc.
 *
 * Features:
 * - Editable rows with inline editing
 * - Checkbox selection & bulk operations
 * - Auto row IDs from Firebase docs
 * - Persistent column visibility
 * - Quick filter search
 * - Safe error handling
 */
export default function UniversalDataGrid({
  // Data
  rows = [],
  columns = [],

  // Row identification
  getRowId,

  // State management
  apiRef,
  loading = false,
  error = null,

  // Editing
  processRowUpdate,
  onProcessRowUpdateError,
  rowModesModel,
  onRowModesModelChange,
  onRowEditStart,
  onRowEditStop,

  // Selection
  checkboxSelection = false,
  rowSelectionModel,
  onRowSelectionModelChange,
  disableRowSelectionOnClick = true,

  // Slots (MUI v8 API)
  slots: slotsProp,
  slotProps: slotsPropsProp,

  // Layout
  density = "compact",
  autoHeight = false,
  pageSizeOptions = [25, 50, 100],
  initialState,
  columnVisibilityModel,
  onColumnVisibilityModelChange,

  // Styling
  sx,

  // Everything else
  ...rest
}) {
  // Default row ID getter (works with Firebase docs)
  const defaultGetRowId = useCallback((row) => {
    return (
      row?.id ??
      row?.docId ??
      row?._id ??
      row?.ticketId ??
      row?.rideId ??
      row?.uid ??
      Math.random().toString(36).slice(2)
    );
  }, []);

  const finalGetRowId = getRowId || defaultGetRowId;

  // Safe rows (always array)
  const safeRows = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    return rows;
  }, [rows]);

  // MUI v8 slots API (no legacy components/componentsProps)
  const mergedSlots = useMemo(
    () => ({
      toolbar: LrpGridToolbar,
      footer: SafeGridFooter,
      noRowsOverlay: NoRowsOverlay,
      errorOverlay: ErrorOverlay,
      ...slotsProp,
    }),
    [slotsProp],
  );

  const mergedSlotProps = useMemo(
    () => ({
      toolbar: {
        showQuickFilter: true,
        quickFilterProps: { debounceMs: 300 },
        ...slotsPropsProp?.toolbar,
      },
      ...slotsPropsProp,
    }),
    [slotsPropsProp],
  );

  // Default initial state
  const finalInitialState = useMemo(
    () => ({
      density: { value: density },
      pagination: {
        paginationModel: { pageSize: pageSizeOptions[0] || 25, page: 0 },
      },
      ...initialState,
    }),
    [density, initialState, pageSizeOptions],
  );

  // Theme-aware styling
  const mergedSx = useMemo(
    () => [
      (theme) => ({
        // Cell styling (remove focus outlines + borders)
        [`& .MuiDataGrid-cell`]: {
          outline: "none",
          borderColor: theme.palette.divider,
        },
        [`& .MuiDataGrid-columnHeader:focus`]: { outline: "none" },

        // Toolbar styling
        [`& .MuiDataGrid-toolbarContainer`]: {
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderBottom: `1px solid ${theme.palette.divider}`,
          padding: theme.spacing(0.5, 1),
          gap: theme.spacing(1),
        },

        // Column headers
        [`& .MuiDataGrid-columnHeaders`]: {
          backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 1 : 0.12),
          color: theme.palette.mode === "dark" ? theme.palette.common.white : theme.palette.text.primary,
          borderBottom: `1px solid ${theme.palette.divider}`,
        },

        // Overall background
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,

        // Full width
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
      }),
      ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
    ],
    [sx],
  );

  return (
    <DataGridPro
      // Data
      rows={safeRows}
      columns={columns}
      getRowId={finalGetRowId}

      // State
      apiRef={apiRef}
      loading={loading}
      error={error}

      // Editing (MUI v8 API)
      processRowUpdate={processRowUpdate}
      onProcessRowUpdateError={onProcessRowUpdateError}
      rowModesModel={rowModesModel}
      onRowModesModelChange={onRowModesModelChange}
      onRowEditStart={onRowEditStart}
      onRowEditStop={onRowEditStop}
      editMode={processRowUpdate ? "row" : undefined}

      // Selection (MUI v8 API)
      checkboxSelection={checkboxSelection}
      rowSelectionModel={rowSelectionModel}
      onRowSelectionModelChange={onRowSelectionModelChange}
      disableRowSelectionOnClick={disableRowSelectionOnClick}

      // Slots (MUI v8 API - NO legacy components/componentsProps)
      slots={mergedSlots}
      slotProps={mergedSlotProps}

      // Layout
      density={density}
      autoHeight={autoHeight}
      pagination
      pageSizeOptions={pageSizeOptions}
      initialState={finalInitialState}
      columnVisibilityModel={columnVisibilityModel}
      onColumnVisibilityModelChange={onColumnVisibilityModelChange}

      // Styling
      sx={mergedSx}

      // Pass through everything else
      {...rest}
    />
  );
}

UniversalDataGrid.propTypes = {
  rows: PropTypes.array,
  columns: PropTypes.array.isRequired,
  getRowId: PropTypes.func,
  apiRef: PropTypes.object,
  loading: PropTypes.bool,
  error: PropTypes.any,
  processRowUpdate: PropTypes.func,
  onProcessRowUpdateError: PropTypes.func,
  rowModesModel: PropTypes.object,
  onRowModesModelChange: PropTypes.func,
  onRowEditStart: PropTypes.func,
  onRowEditStop: PropTypes.func,
  checkboxSelection: PropTypes.bool,
  rowSelectionModel: PropTypes.array,
  onRowSelectionModelChange: PropTypes.func,
  disableRowSelectionOnClick: PropTypes.bool,
  slots: PropTypes.object,
  slotProps: PropTypes.object,
  density: PropTypes.oneOf(["compact", "standard", "comfortable"]),
  autoHeight: PropTypes.bool,
  pageSizeOptions: PropTypes.array,
  initialState: PropTypes.object,
  columnVisibilityModel: PropTypes.object,
  onColumnVisibilityModelChange: PropTypes.func,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.func]),
};
