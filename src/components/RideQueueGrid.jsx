import React, { useEffect, useState, useMemo } from "react";

import { subscribeQueueRides } from "../hooks/api";
import { rideColumns } from "../columns/rideColumns.jsx";

import LRPDataGrid from "./LRPDataGrid.jsx";

export default function RideQueueGrid() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    return subscribeQueueRides(setRows, console.error);
  }, []);

  const columns = useMemo(() => rideColumns(), []);

  return (
    <LRPDataGrid
      rows={Array.isArray(rows) ? rows : []}
      columns={columns}
      autoHeight
      loading={false}
      checkboxSelection={false}
    />
  );
}
