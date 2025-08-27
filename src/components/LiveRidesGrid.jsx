import React, { useEffect, useState, useMemo } from "react";

import { subscribeLiveRides } from "../hooks/api";
import { rideColumns } from "../columns/rideColumns.jsx";

import LRPDataGrid from "./LRPDataGrid.jsx";

export default function LiveRidesGrid() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    return subscribeLiveRides(setRows, console.error);
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
