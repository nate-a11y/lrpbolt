import * as React from "react";
import { Button, Box } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import {
  GridToolbarContainer,
  GridToolbarQuickFilter,
  GridToolbarExport,
  useGridApiContext,
} from "@mui/x-data-grid-pro";

// Exports only the currently selected rows to CSV
function ExportSelectedButton() {
  const apiRef = useGridApiContext();

  const handleExportSelected = () => {
    try {
      const selectedIds = Array.from(apiRef.current.getSelectedRows().keys());
      if (!selectedIds.length) return;

      apiRef.current.exportDataAsCsv({
        utf8WithBom: true,
        // Export only selected rows
        getRowsToExport: () => selectedIds,
      });
    } catch (err) {
      console.error("Export selected failed:", err);
    }
  };

  return (
    <Button
      onClick={handleExportSelected}
      startIcon={<DownloadIcon />}
      size="small"
      variant="outlined"
    >
      Export Selected
    </Button>
  );
}

export default function CustomToolbar({ extraActions }) {
  return (
    <GridToolbarContainer>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
          width: "100%",
        }}
      >
        <GridToolbarQuickFilter />
        {/* Built-in Export (All/Filtered) */}
        <GridToolbarExport
          csvOptions={{ utf8WithBom: true }}
          printOptions={{ disableToolbarButton: true }}
        />
        {/* Custom Export Selected */}
        <ExportSelectedButton />
        {extraActions}
      </Box>
    </GridToolbarContainer>
  );
}
