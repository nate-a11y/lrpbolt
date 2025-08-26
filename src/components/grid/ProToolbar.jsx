import * as React from "react";
import {
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarExport,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid-pro";
import { Stack, Button } from "@mui/material";

export default function ProToolbar({ onReset }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1 }}>
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
      <GridToolbarDensitySelector />
      <GridToolbarExport csvOptions={{ utf8WithBom: true }} />
      <GridToolbarQuickFilter debounceMs={400} />
      {onReset ? (
        <Button size="small" onClick={onReset}>
          Reset view
        </Button>
      ) : null}
    </Stack>
  );
}
