import * as React from "react";
import { Box } from "@mui/material";
import { DataGridPro } from "@mui/x-data-grid-pro";

import LrpGridToolbar from "src/components/datagrid/LrpGridToolbar.jsx";

const rows = [{ id: "a1", name: "Test Row" }];
const columns = [{ field: "name", headerName: "Name", flex: 1 }];

export default function SanityGrid() {
  return (
    <Box
      sx={(t) => ({ height: 400, bgcolor: t.palette.background.paper, p: 2 })}
    >
      <DataGridPro
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        density="compact"
        slots={{ toolbar: LrpGridToolbar }}
        slotProps={{ toolbar: { quickFilterPlaceholder: "Search" } }}
        components={{ Toolbar: LrpGridToolbar }}
        componentsProps={{ toolbar: { quickFilterPlaceholder: "Search" } }}
      />
    </Box>
  );
}
