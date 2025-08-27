import React, { useEffect, useState, useCallback } from "react";

import { subscribeClaimedRides } from "../hooks/api";
import { deleteRide } from "../services/firestoreService";
import { buildNativeActionsColumn } from "../columns/nativeActions.jsx";
import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";

import EditRideDialog from "./EditRideDialog.jsx";

export default function ClaimedRidesGrid() {
  const [rows, setRows] = useState([]);
  const [editRow, setEditRow] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    return subscribeClaimedRides(setRows, console.error);
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
        rows={Array.isArray(rows) ? rows : []}
        headerMap={{
          tripId: "Trip ID",
          pickupTime: "Pickup",
          rideDuration: "Dur (min)",
          rideType: "Type",
          vehicle: "Vehicle",
          rideNotes: "Notes",
          claimedBy: "Claimed By",
          claimedAt: "Claimed At",
          status: "Status",
          createdAt: "Created",
        }}
        order={["tripId","pickupTime","rideDuration","rideType","vehicle","claimedBy","claimedAt","status"]}
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
