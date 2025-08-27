/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState } from "react";
import { doc, deleteDoc } from "firebase/firestore";

import SmartAutoGrid from "../datagrid/SmartAutoGrid.jsx";
import { buildNativeActionsColumn } from "../../columns/nativeActions.jsx";
import { subscribeShootoutStats } from "../../hooks/firestore";
import { db } from "../../utils/firebaseInit";
import { enrichDriverNames } from "../../services/normalizers";

export default function ShootoutStatsTab() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const unsub = subscribeShootoutStats(
      async (stats) => {
        const withNames = await enrichDriverNames(stats || []);
        setRows(withNames);
      },
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
        driver: "Driver",
        vehicle: "Vehicle",
        startTime: "Start",
        endTime: "End",
        duration: "Duration",
        trips: "Trips",
        passengers: "PAX",
        createdAt: "Created",
        id: "id",
      }}
      order={[
        "driver",
        "driverEmail",
        "vehicle",
        "startTime",
        "endTime",
        "duration",
        "trips",
        "passengers",
        "createdAt",
        "id",
      ]}
      forceHide={["id"]}
      actionsColumn={buildNativeActionsColumn({
        onEdit: (id, row) => openSessionEdit?.(row),
        onDelete: async (id) => await deleteShootoutStatById(id),
      })}
    />
  );
}
