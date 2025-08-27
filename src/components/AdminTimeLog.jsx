import React, { useEffect, useState, useMemo } from "react";

import { subscribeTimeLogs } from "../hooks/api";

import { timeLogColumns } from "../columns/timeLogColumns.js";

import PageContainer from "./PageContainer.jsx";
import LRPDataGrid from "./LRPDataGrid.jsx";

export default function AdminTimeLog() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    return subscribeTimeLogs(setRows, console.error);
  }, []);

  const columns = useMemo(() => timeLogColumns(), []);

  return (
    <PageContainer title="Admin Logs">
      <LRPDataGrid
        rows={Array.isArray(rows) ? rows : []}
        columns={columns}
        autoHeight
        loading={false}
        checkboxSelection={false}
      />
    </PageContainer>
  );
}
