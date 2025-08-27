import React, { useEffect, useState, useCallback } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { deleteRide } from "../services/firestoreService";
import { buildNativeActionsColumn } from "../columns/nativeActions.jsx";
import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";
import { mapSnapshotToRows } from "../services/normalizers";
import { db } from "../utils/firebaseInit";

import EditRideDialog from "./EditRideDialog.jsx";

export default function ClaimedRidesGrid() {
  const [rows, setRows] = useState([]);
  const [editRow, setEditRow] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "claimedRides"),
      (snap) => setRows(mapSnapshotToRows("claimedRides", snap)),
      console.error,
    );
    return () => unsub();
  }, []);

  const handleEditRide = useCallback((row) => {
    setEditRow(row);
    setEditOpen(true);
  }, []);

  const handleEditClose = useCallback(() => {
    setEditOpen(false);
    setEditRow(null);
  }, []);

  return (
    <>
      <SmartAutoGrid
        rows={rows}
        headerMap={{
          tripId: "Trip ID",
          pickupTime: "Pickup",
          rideDuration: "Dur",
          rideType: "Type",
          vehicle: "Vehicle",
          rideNotes: "Notes",
          createdAt: "Created",
        }}
        order={["tripId","pickupTime","rideDuration","rideType","vehicle","rideNotes","createdAt"]}
        hide={["claimedBy","claimedAt","status"]}
        actionsColumn={buildNativeActionsColumn({
          onEdit: (id, row) => handleEditRide(row),
          onDelete: async (id) => await deleteRide("claimedRides", id),
          showInMenu: true,
        })}
      />
      {editOpen && (
        <EditRideDialog
          open={editOpen}
          onClose={handleEditClose}
          collectionName="claimedRides"
          ride={editRow}
        />
      )}
    </>
  );
}
