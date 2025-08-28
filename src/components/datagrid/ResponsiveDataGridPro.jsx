import React, { useMemo, useState, useCallback } from "react";
import { DataGridPro, gridClasses } from "@mui/x-data-grid-pro";
import { Box } from "@mui/material";

import useIsMobile from "../../hooks/useIsMobile";

/**
 * Drop-in wrapper for DataGridPro that improves mobile ergonomics.
 * - autoHeight on small screens
 * - compact density on mobile
 * - horizontal scroll containment
 * - stable getRowId required from parent
 */
export default function ResponsiveDataGridPro(props) {
  const { isMdDown } = useIsMobile();
  const {
    sx,
    density,
    disableRowSelectionOnClick = true,
    pagination = true,
    hideFooterSelectedRowCount = true,
    rowBuffer = 3,
    getRowId,
    rowSelectionModel: rowSelectionModelProp,
    onRowSelectionModelChange: onRowSelectionModelChangeProp,
    paginationModel: paginationModelProp,
    onPaginationModelChange: onPaginationModelChangeProp,
    slots: slotsProp,
    ...rest
  } = props;

  const [rowSelectionModel, setRowSelectionModel] = useState(
    rowSelectionModelProp || [],
  );
  const handleRowSelectionModelChange = useCallback(
    (m) => {
      const next = Array.isArray(m) ? m : [];
      setRowSelectionModel(next);
      if (onRowSelectionModelChangeProp)
        onRowSelectionModelChangeProp(next);
    },
    [onRowSelectionModelChangeProp],
  );

  const [paginationModel, setPaginationModel] = useState(
    paginationModelProp || { page: 0, pageSize: 25 },
  );
  const handlePaginationModelChange = useCallback(
    (m) => {
      const next = m || { page: 0, pageSize: 25 };
      setPaginationModel(next);
      if (onPaginationModelChangeProp)
        onPaginationModelChangeProp(next);
    },
    [onPaginationModelChangeProp],
  );

  const resolvedDensity = useMemo(
    () => (isMdDown ? "compact" : density || "standard"),
    [isMdDown, density],
  );

  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <DataGridPro
        {...rest}
        getRowId={
          getRowId ||
          ((row) => row.id || row.docId || row.ticketId || row._id)
        }
        rowSelectionModel={rowSelectionModel}
        onRowSelectionModelChange={handleRowSelectionModelChange}
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationModelChange}
        pageSizeOptions={[10, 25, 50, 100]}
        slots={{
          noRowsOverlay: () => <div style={{ padding: 16 }}>No data</div>,
          errorOverlay: () => <div style={{ padding: 16 }}>Error loading data</div>,
          ...(slotsProp || {}),
        }}
        sx={{
          [`& .${gridClasses.columnHeader}`]: {
            whiteSpace: "nowrap",
          },
          "& .MuiDataGrid-cell": {
            lineHeight: { xs: "1.25rem", md: "1.5rem" },
            py: { xs: 0.5, md: 1 },
          },
          "& .MuiDataGrid-virtualScroller": {
            WebkitOverflowScrolling: "touch",
            overscrollBehaviorX: "contain",
          },
          "& .MuiDataGrid-footerContainer": {
            px: { xs: 1, md: 2 },
          },
          ...sx,
        }}
        autoHeight={isMdDown ? true : rest.autoHeight}
        density={resolvedDensity}
        disableRowSelectionOnClick={disableRowSelectionOnClick}
        pagination={pagination}
        hideFooterSelectedRowCount={hideFooterSelectedRowCount}
        rowBuffer={rowBuffer}
      />
    </Box>
  );
}
