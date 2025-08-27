import React, { useEffect, useState } from "react";
import { DataGrid } from "@mui/x-data-grid-pro";
import { rideColumns } from "./rides/rideColumns";
import { subscribeLiveRides } from "../hooks/api";

export default function LiveRidesGrid() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    return subscribeLiveRides(setRows, console.error);
  }, []);

  return (
    <DataGrid
      rows={rows}
      columns={rideColumns}
      getRowId={(r) => r.id}
      density="comfortable"
      disableRowSelectionOnClick
      autoHeight
    />
  );
}
