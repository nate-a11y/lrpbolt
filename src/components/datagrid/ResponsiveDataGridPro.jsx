import React, { useMemo } from "react";
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
    ...rest
  } = props;

  const resolvedDensity = useMemo(() => (isMdDown ? "compact" : (density || "standard")), [isMdDown, density]);

  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <DataGridPro
        {...rest}
        sx={{
          [`& .${gridClasses.columnHeader}`]: {
            whiteSpace: "nowrap",
          },
          "& .MuiDataGrid-cell": {
            lineHeight: { xs: "1.25rem", md: "1.5rem" },
            py: { xs: 0.5, md: 1 },
          },
          "& .MuiDataGrid-virtualScroller": {
            overflowX: "hidden",
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
      />
    </Box>
  );
}
