import React, { useEffect, useState, useCallback } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Paper } from "@mui/material";
import { useGridApiRef } from "@mui/x-data-grid-pro";

import BulkDeleteButton from "@/components/datagrid/bulkDelete/BulkDeleteButton.jsx";
import ConfirmBulkDeleteDialog from "@/components/datagrid/bulkDelete/ConfirmBulkDeleteDialog.jsx";
import useBulkDelete from "@/components/datagrid/bulkDelete/useBulkDelete.jsx";

import { buildNativeActionsColumn } from "../columns/nativeActions.jsx";
import { deleteRide, createRide } from "../services/firestoreService";
import { mapSnapshotToRows } from "../services/normalizers";
import { db } from "../utils/firebaseInit";

import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";
import EditRideDialog from "./EditRideDialog.jsx";

export default function ClaimedRidesGrid() {
  const [rows, setRows] = useState([]);
  const [editRow, setEditRow] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const apiRef = useGridApiRef();
  const [selectionModel, setSelectionModel] = useState([]);

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

  const performDelete = useCallback(async (ids) => {
    for (const id of ids) {
      try {
        await deleteRide("claimedRides", id);
      } catch (err) {
        console.error("Failed deleting ride", id, err);
      }
    }
  }, []);

  performDelete.restore = async (rowsToRestore) => {
    for (const r of rowsToRestore) {
      try {
        await createRide("claimedRides", r);
      } catch (err) {
        console.error("Failed restoring ride", r?.id, err);
      }
    }
  };

  const { dialogOpen, deleting, openDialog, closeDialog, onConfirm } =
    useBulkDelete({ performDelete });

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
          checkboxSelection
          disableRowSelectionOnClick
          apiRef={apiRef}
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={(m) => setSelectionModel(m)}
          showToolbar
          slotProps={{
            toolbar: {
              extraActions: (
                <BulkDeleteButton
                  count={selectionModel.length}
                  disabled={deleting}
                  onClick={() => {
                    const sel = apiRef.current.getSelectedRows();
                    const ids = Array.from(sel.keys());
                    const rows = Array.from(sel.values());
                    openDialog(ids, rows);
                  }}
                />
              ),
            },
          }}
        />
        <ConfirmBulkDeleteDialog
          open={dialogOpen}
          total={selectionModel.length}
          deleting={deleting}
          onClose={closeDialog}
          onConfirm={onConfirm}
          sampleRows={Array.from(apiRef.current.getSelectedRows().values())}
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
