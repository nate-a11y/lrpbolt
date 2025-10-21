/* Proprietary and confidential. See LICENSE. */
import { memo, useMemo } from "react";
import { GridToolbar } from "@mui/x-data-grid-pro";

import LrpDataGridPro from "@/components/datagrid/LrpDataGridPro";

const DEFAULT_PAGE_SIZE = 50;

/**
 * SmartDataGrid: centralized DataGrid defaults for performance.
 * Wraps LrpDataGridPro so we keep persistence, overlays, and custom UX.
 */
function SmartDataGridBase({
  rows = [],
  columns,
  getRowId,
  loading = false,
  checkboxSelection = true,
  disableRowSelectionOnClick = true,
  density = "compact",
  slots,
  slotProps,
  initialState,
  pageSizeOptions,
  experimentalFeatures,
  sx: sxProp,
  ...rest
}) {
  const stableGetRowId = useMemo(
    () =>
      getRowId || ((row) => row?.id || row?.rideId || row?.ticketId || null),
    [getRowId],
  );

  const stableColumns = useMemo(() => columns || [], [columns]);

  const gridSlots = useMemo(
    () => ({
      toolbar: GridToolbar,
      ...slots,
    }),
    [slots],
  );

  const gridSlotProps = useMemo(
    () => ({
      toolbar: {
        showQuickFilter: true,
        quickFilterProps: { debounceMs: 300 },
      },
      ...slotProps,
    }),
    [slotProps],
  );

  const state = useMemo(
    () =>
      initialState || {
        pagination: {
          paginationModel: { pageSize: DEFAULT_PAGE_SIZE, page: 0 },
        },
        density,
      },
    [initialState, density],
  );

  const pageSizes = useMemo(
    () => pageSizeOptions || [25, 50, 100],
    [pageSizeOptions],
  );

  const mergedExperimentalFeatures = useMemo(
    () => ({ ariaV7: true, ...(experimentalFeatures || {}) }),
    [experimentalFeatures],
  );

  const safeRows = Array.isArray(rows) ? rows : [];

  const toolbarSx = useMemo(
    () => (theme) => ({
      "& .MuiDataGrid-toolbarContainer": {
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
      },
    }),
    [],
  );

  const mergedSx = useMemo(() => {
    if (!sxProp) return toolbarSx;
    if (Array.isArray(sxProp)) return [toolbarSx, ...sxProp];
    return [toolbarSx, sxProp];
  }, [sxProp, toolbarSx]);

  return (
    <LrpDataGridPro
      rows={safeRows}
      columns={stableColumns}
      getRowId={stableGetRowId}
      loading={loading}
      checkboxSelection={checkboxSelection}
      disableRowSelectionOnClick={disableRowSelectionOnClick}
      density={density}
      slots={gridSlots}
      slotProps={gridSlotProps}
      initialState={state}
      pageSizeOptions={pageSizes}
      disableColumnFilter={false}
      disableColumnSelector={false}
      disableDensitySelector={false}
      experimentalFeatures={mergedExperimentalFeatures}
      sx={mergedSx}
      {...rest}
    />
  );
}

const SmartDataGrid = memo(SmartDataGridBase);

export default SmartDataGrid;
