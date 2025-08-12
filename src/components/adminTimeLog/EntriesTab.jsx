/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState } from "react";
import { Box, Stack } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { subscribeTimeLogs } from "../../hooks/firestore";
import ToolsCell from "./cells/ToolsCell.jsx";
import StatusCell from "./cells/StatusCell.jsx";

export default function EntriesTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeTimeLogs((data) => {
      setRows(data);
      setLoading(false);
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  const columns = useMemo(
    () => [
      { field: "driver", headerName: "Driver", flex: 1, minWidth: 140 },
      { field: "rideId", headerName: "Ride ID", width: 120 },
      {
        field: "status",
        headerName: "Status",
        width: 120,
        renderCell: (params) => <StatusCell value={params.value} />,
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 200,
        sortable: false,
        renderCell: (params) => <ToolsCell row={params.row} />,
      },
    ],
    [],
  );

  return (
    <Stack spacing={2}>
      <Box sx={{ height: 560, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.id}
          disableRowSelectionOnClick
        />
      </Box>
    </Stack>
  );
}
