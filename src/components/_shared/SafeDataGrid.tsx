/* SafeDataGrid: drop-in bulletproof wrapper for MUI DataGrid */
import React from "react";
import { GridOverlay, type GridColDef } from "@mui/x-data-grid-pro";
import { Box, Typography, Stack } from "@mui/material";
import SmartAutoGrid from "../datagrid/SmartAutoGrid.jsx";

function NoRows() {
  return (
    <GridOverlay>
      <Stack sx={{ width: "100%", py: 4 }} alignItems="center" justifyContent="center">
        <Typography variant="body2" color="text.secondary">No rows</Typography>
      </Stack>
    </GridOverlay>
  );
}

// Remove bad/undefined columns defensively
function sanitizeColumns(cols: any[]): GridColDef[] {
  if (!Array.isArray(cols)) return [];
  return cols
    .filter(Boolean)
    // drop placeholder/internal columns if they’re not fully defined
    .filter((c) => c && c.field && !String(c.field).startsWith("__"))
    // ensure header names exist
    .map((c) => ({ headerName: c.headerName ?? String(c.field), sortable: true, flex: 0, minWidth: 80, ...c }));
}

type Props = React.ComponentProps<typeof SmartAutoGrid>;
export default function SafeDataGrid(props: Props) {
  const rows = Array.isArray(props.rows) ? props.rows : [];
  const columns = sanitizeColumns((props as any).columns || []);
  const getRowId = props.getRowId || ((r: any) => r?.id ?? r?.rideId ?? r?._id ?? JSON.stringify(r));

  return (
    <Box sx={{ width: "100%", height: props.autoHeight ? "auto" : (props as any).height || 560 }}>
      <SmartAutoGrid
        rows={rows}
        columnsCompat={columns}
        getRowId={getRowId}
        disableRowSelectionOnClick
        slots={{ noRowsOverlay: NoRows }}
        showToolbar
        {...props}
      />
    </Box>
  );
}
