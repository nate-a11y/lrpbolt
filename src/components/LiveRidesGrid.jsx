import React, { useEffect, useState, useCallback, useMemo } from "react";
import { collection, onSnapshot, writeBatch, doc } from "firebase/firestore";
import { Paper } from "@mui/material";
import { useGridApiRef } from "@mui/x-data-grid-pro";

import logError from "@/utils/logError.js";
import AppError from "@/utils/AppError.js";
import ConfirmBulkDeleteDialog from "@/components/datagrid/bulkDelete/ConfirmBulkDeleteDialog.jsx";
import useBulkDelete from "@/components/datagrid/bulkDelete/useBulkDelete.jsx";

import { buildNativeActionsColumn } from "../columns/nativeActions.jsx";
import { deleteRide } from "../services/firestoreService";
import { mapSnapshotToRows } from "../services/normalizers";
import { db } from "../utils/firebaseInit";

import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";
import EditRideDialog from "./EditRideDialog.jsx";

export default function LiveRidesGrid() {
  const [rows, setRows] = useState([]);
  const [editRow, setEditRow] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const apiRef = useGridApiRef();
  const [selectionModel, setSelectionModel] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "liveRides"),
      (snap) => setRows(mapSnapshotToRows("liveRides", snap)),
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
    const backoff = (a) => new Promise((res) => setTimeout(res, 2 ** a * 100));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const batch = writeBatch(db);
        ids.forEach((id) => batch.delete(doc(db, "liveRides", id)));
        await batch.commit();
        return;
      } catch (err) {
        if (attempt === 2) {
          logError(err, { where: "LiveRidesGrid", action: "bulkDelete" });
          throw new AppError(
            err.message || "Bulk delete failed",
            "FIRESTORE_DELETE",
            { collection: "liveRides" },
          );
        }
        await backoff(attempt);
      }
    }
  }, []);

  performDelete.restore = async (rowsToRestore) => {
    const backoff = (a) => new Promise((res) => setTimeout(res, 2 ** a * 100));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const batch = writeBatch(db);
        rowsToRestore.forEach((r) => {
          if (!r) return;
          const { id, ...rest } = r;
          batch.set(doc(db, "liveRides", id), rest);
        });
        await batch.commit();
        return;
      } catch (err) {
        if (attempt === 2) {
          logError(err, { where: "LiveRidesGrid", action: "bulkRestore" });
        } else {
          await backoff(attempt);
        }
      }
    }
  };

  const { dialogOpen, deleting, openDialog, closeDialog, onConfirm } =
    useBulkDelete({ performDelete });

  const handleBulkDelete = useCallback(
    async (ids) => {
      const rowsToDelete = ids
        .map((id) => apiRef.current?.getRow?.(id))
        .filter(Boolean);
      openDialog(ids, rowsToDelete);
    },
    [apiRef, openDialog],
  );

  const sampleRows = useMemo(() => {
    const sel = apiRef.current?.getSelectedRows?.() || new Map();
    return selectionModel.map((id) => sel.get(id)).filter(Boolean);
  }, [apiRef, selectionModel]);

  return (
    <>
      <Paper sx={{ width: "100%" }}>
        <SmartAutoGrid
          rows={rows}
          headerMap={{
            tripId: "Trip ID",
            pickupTime: "Pickup",
            rideDuration: "Duration",
            rideType: "Type",
            vehicle: "Vehicle",
            rideNotes: "Notes",
            createdAt: "Created",
            claimedBy: "Claimed By",
            claimedAt: "Claimed At",
            status: "Status",
          }}
          order={[
            "tripId",
            "pickupTime",
            "rideDuration",
            "rideType",
            "vehicle",
            "rideNotes",
            "createdAt",
            "claimedBy",
            "claimedAt",
            "status",
          ]}
          hide={["claimedBy", "claimedAt", "status"]}
          forceHide={[]}
          actionsColumn={buildNativeActionsColumn({
            onEdit: (id, row) => handleEditRide(row),
            onDelete: async (id) => await deleteRide("liveRides", id),
          })}
          checkboxSelection
          disableRowSelectionOnClick
          apiRef={apiRef}
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={(m) => setSelectionModel(m)}
          slotProps={{
            toolbar: {
              onDeleteSelected: handleBulkDelete,
              quickFilterPlaceholder: "Search",
            },
          }}
          sx={{ height: 520 }}
        />
        <ConfirmBulkDeleteDialog
          open={dialogOpen}
          total={selectionModel.length}
          deleting={deleting}
          onClose={closeDialog}
          onConfirm={onConfirm}
          sampleRows={sampleRows}
        />
      </Paper>
      {editOpen && (
        <EditRideDialog
          open={editOpen}
          onClose={handleEditClose}
          collectionName="liveRides"
          ride={editRow}
        />
      )}
    </>
  );
}
