/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState } from "react";
import { doc, deleteDoc } from "firebase/firestore";

import SmartAutoGrid from "../datagrid/SmartAutoGrid.jsx";
import { buildNativeActionsColumn } from "../../columns/nativeActions.jsx";
import { subscribeShootoutStats } from "../../hooks/firestore";
import { db } from "../../utils/firebaseInit";

export default function ShootoutStatsTab() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const unsub = subscribeShootoutStats(
      (stats) => setRows(stats || []),
      (e) => console.error(e),
    );
    return () => typeof unsub === "function" && unsub();
  }, []);

  const openSessionEdit = null;

  const deleteShootoutStatById = async (id) => {
    await deleteDoc(doc(db, "shootoutStats", id));
  };

  return (
    <SmartAutoGrid
      rows={rows}
      headerMap={{
        driverEmail: "Driver Email",
        vehicle: "Vehicle",
        startTime: "Start",
        endTime: "End",
        trips: "Trips",
        passengers: "PAX",
        createdAt: "Created",
      }}
      order={[
        "driverEmail",
        "vehicle",
        "startTime",
        "endTime",
        "trips",
        "passengers",
        "createdAt",
      ]}
      actionsColumn={buildNativeActionsColumn({
        onEdit: (id, row) => openSessionEdit?.(row),
        onDelete: async (id) => await deleteShootoutStatById(id),
      })}
    />
  );
}
