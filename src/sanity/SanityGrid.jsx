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
          "& .MuiDataGrid-cell": { borderColor: t.palette.divider },
        })}
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
