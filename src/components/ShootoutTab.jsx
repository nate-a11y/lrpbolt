/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, doc, deleteDoc } from "firebase/firestore";

import { buildNativeActionsColumn } from "../columns/nativeActions.jsx";
import { mapSnapshotToRows } from "../services/normalizers";
import { db } from "../utils/firebaseInit";

import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";

export default function ShootoutTab() {
  const [sessionRows, setSessionRows] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "shootoutStats"), (snap) => {
      setSessionRows(mapSnapshotToRows("shootoutStats", snap));
    });
    return () => unsub();
  }, []);

  const openSessionEdit = null;

  const deleteShootoutStatById = async (id) => {
    await deleteDoc(doc(db, "shootoutStats", id));
  };

  return (
    <SmartAutoGrid
      rows={sessionRows}
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
