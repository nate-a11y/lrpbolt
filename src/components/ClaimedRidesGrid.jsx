import React, { useEffect, useState, useCallback } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Paper } from "@mui/material";

import { buildNativeActionsColumn } from "../columns/nativeActions.jsx";
import { deleteRide } from "../services/firestoreService";
import { mapSnapshotToRows } from "../services/normalizers";
import { db } from "../utils/firebaseInit";

import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";
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
      <Paper sx={{ width: "100%" }}>
        <SmartAutoGrid
          rows={rows}
          headerMap={{
            tripId: "Trip ID",
            claimedBy: "Claimed By",
            pickupTime: "Pickup",
            rideDuration: "Duration",
            rideType: "Type",
            vehicle: "Vehicle",
            rideNotes: "Notes",
            createdAt: "Created",
            claimedAt: "Claimed At",
            status: "Status",
          }}
          order={[
            "tripId",
            "claimedBy",
            "pickupTime",
            "rideDuration",
            "rideType",
            "vehicle",
            "rideNotes",
            "createdAt",
            "claimedAt",
            "status",
          ]}
          hide={["claimedAt", "status"]}
          forceHide={[]}
          actionsColumn={buildNativeActionsColumn({
            onEdit: (id, row) => handleEditRide(row),
            onDelete: async (id) => await deleteRide("claimedRides", id),
          })}
        />
      </Paper>
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
