import React, { useEffect, useState } from "react";
import PageContainer from "./PageContainer.jsx";
import SafeDataGrid from "./_shared/SafeDataGrid.tsx";
import { subscribeTimeLogs } from "../hooks/api";
import { timeLogColumns } from "./adminLogs/columns.js";

export default function AdminTimeLog() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    return subscribeTimeLogs(setRows, console.error);
  }, []);

  return (
    <PageContainer title="Admin Logs">
      <SafeDataGrid
        rows={rows}
        columns={timeLogColumns}
        getRowId={(r) => r.id}
        autoHeight
      />
    </PageContainer>
  );
}
