import React, { useEffect, useState, useMemo, useCallback } from "react";

import { subscribeQueueRides } from "../hooks/api";
import { rideColumns } from "../columns/rideColumns.jsx";
import { deleteRide } from "../services/firestoreService";

import EditRideDialog from "./EditRideDialog.jsx";
import LRPDataGrid from "./LRPDataGrid.jsx";

export default function RideQueueGrid() {
  const [rows, setRows] = useState([]);
  const [editRow, setEditRow] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    return subscribeQueueRides(setRows, console.error);
  }, []);

  const handleEditRide = useCallback((row) => {
    setEditRow(row);
    setEditOpen(true);
  }, []);

  const handleEditClose = useCallback(() => {
    setEditOpen(false);
    setEditRow(null);
  }, []);

  const handleDeleteRide = useCallback(async (row) => {
    if (!row?.id) return;
    if (!window.confirm("Delete this ride?")) return;
    try {
      await deleteRide("rideQueue", row.id);
    } catch (e) {
      console.error(e);
      alert("Failed to delete ride");
    }
  }, []);

  const columns = useMemo(
    () => rideColumns({ withActions: true, onEdit: handleEditRide, onDelete: handleDeleteRide }),
    [handleEditRide, handleDeleteRide]
  );

  return (
    <>
      <LRPDataGrid
        rows={Array.isArray(rows) ? rows : []}
        columns={columns}
        autoHeight
        loading={false}
        checkboxSelection={false}
      />
      {editOpen && (
        <EditRideDialog
          open={editOpen}
          onClose={handleEditClose}
          collectionName="rideQueue"
          ride={editRow}
        />
      )}
    </>
  );
}
