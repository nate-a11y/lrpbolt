import React, { useEffect, useMemo, useState } from "react";
import { DataGrid } from "@mui/x-data-grid-pro";
import PageContainer from "./PageContainer.jsx";
import { subscribeTimeLogs } from "../hooks/api";
import { timeLogColumns } from "./adminLogs/columns";

export default function AdminTimeLog() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    return subscribeTimeLogs(setRows, console.error);
  }, []);

  return (
    <PageContainer title="Admin Logs">
      <DataGrid
        rows={rows}
        columns={timeLogColumns}
        getRowId={(r) => r.id}
        density="comfortable"
        disableRowSelectionOnClick
        autoHeight
      />
    </PageContainer>
  );
}
