import React, { useEffect, useState, useCallback, useMemo } from "react";
import { collection, onSnapshot, writeBatch, doc } from "firebase/firestore";
import { Paper } from "@mui/material";
import { useGridApiRef } from "@mui/x-data-grid-pro";

import logError from "@/utils/logError.js";
import AppError from "@/utils/AppError.js";
import ConfirmBulkDeleteDialog from "@/components/datagrid/bulkDelete/ConfirmBulkDeleteDialog.jsx";
import useBulkDelete from "@/components/datagrid/bulkDelete/useBulkDelete.jsx";
import { formatDateTime } from "@/utils/time";
import LrpDataGridPro from "@/components/datagrid/LrpDataGridPro";

import { buildNativeActionsColumn } from "../columns/nativeActions.jsx";
import { deleteRide } from "../services/firestoreService";
import { mapSnapshotToRows } from "../services/normalizers";
import { db } from "../utils/firebaseInit";

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
    const backoff = (a) => new Promise((res) => setTimeout(res, 2 ** a * 100));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const batch = writeBatch(db);
        ids.forEach((id) => batch.delete(doc(db, "claimedRides", id)));
        await batch.commit();
        return;
      } catch (err) {
        if (attempt === 2) {
          logError(err, { where: "ClaimedRidesGrid", action: "bulkDelete" });
          throw new AppError(
            err.message || "Bulk delete failed",
            "FIRESTORE_DELETE",
            { collection: "claimedRides" },
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
          batch.set(doc(db, "claimedRides", id), rest);
        });
        await batch.commit();
        return;
      } catch (err) {
        if (attempt === 2) {
          logError(err, { where: "ClaimedRidesGrid", action: "bulkRestore" });
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
      const rows = ids
        .map((id) => apiRef.current?.getRow?.(id))
        .filter(Boolean);
      openDialog(ids, rows);
    },
    [apiRef, openDialog],
  );

  const sampleRows = useMemo(() => {
    const sel = apiRef.current?.getSelectedRows?.() || new Map();
    return selectionModel.map((id) => sel.get(id)).filter(Boolean);
  }, [apiRef, selectionModel]);

  const getRowId = useCallback((row) => {
    if (row?.id != null) return String(row.id);
    if (row?.rideId != null) return String(row.rideId);
    return null;
  }, []);

  const formatMinutes = useCallback((raw) => {
    const minutes = Number(raw);
    if (!Number.isFinite(minutes) || minutes <= 0) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h 0m`;
    }
    return `${mins}m`;
  }, []);

  const initialState = useMemo(
    () => ({
      pagination: { paginationModel: { pageSize: 15, page: 0 } },
      columns: {
        columnVisibilityModel: {
          claimedAt: false,
          status: false,
        },
      },
    }),
    [],
  );

  const columns = useMemo(() => {
    const baseColumns = [
      {
        field: "tripId",
        headerName: "Trip ID",
        minWidth: 140,
        flex: 0.8,
        valueGetter: (params) => {
          const value = params?.row?.tripId ?? params?.row?.id;
          return value ? String(value) : "N/A";
        },
      },
      {
        field: "claimedBy",
        headerName: "Claimed By",
        minWidth: 160,
        flex: 1,
        valueGetter: (params) => params?.row?.claimedBy || "N/A",
      },
      {
        field: "pickupTime",
        headerName: "Pickup",
        minWidth: 180,
        flex: 1,
        valueGetter: (params) => formatDateTime(params?.row?.pickupTime),
      },
      {
        field: "rideDuration",
        headerName: "Duration",
        minWidth: 120,
        flex: 0.7,
        valueGetter: (params) => formatMinutes(params?.row?.rideDuration),
      },
      {
        field: "rideType",
        headerName: "Type",
        minWidth: 140,
        flex: 1,
        valueGetter: (params) => params?.row?.rideType || "N/A",
      },
      {
        field: "vehicle",
        headerName: "Vehicle",
        minWidth: 140,
        flex: 1,
        valueGetter: (params) => params?.row?.vehicle || "N/A",
      },
      {
        field: "rideNotes",
        headerName: "Notes",
        minWidth: 180,
        flex: 1.4,
        valueGetter: (params) => params?.row?.rideNotes || "N/A",
      },
      {
        field: "createdAt",
        headerName: "Created",
        minWidth: 180,
        flex: 1,
        valueGetter: (params) => formatDateTime(params?.row?.createdAt),
      },
      {
        field: "claimedAt",
        headerName: "Claimed At",
        minWidth: 180,
        flex: 1,
        valueGetter: (params) => formatDateTime(params?.row?.claimedAt),
      },
      {
        field: "status",
        headerName: "Status",
        minWidth: 140,
        flex: 0.8,
        valueGetter: (params) => params?.row?.status || "N/A",
      },
    ];

    const actionsColumn = buildNativeActionsColumn({
      onEdit: (_id, row) => handleEditRide(row),
      onDelete: async (id) => await deleteRide("claimedRides", id),
    });

    return [...baseColumns, actionsColumn];
  }, [formatMinutes, handleEditRide]);

  return (
    <>
      <Paper sx={{ width: "100%", display: "flex", flexDirection: "column" }}>
        <LrpDataGridPro
          id="claimed-grid"
          rows={rows}
          columns={columns}
          getRowId={getRowId}
          checkboxSelection
          disableRowSelectionOnClick
          apiRef={apiRef}
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={(m) => setSelectionModel(m)}
          initialState={initialState}
          pageSizeOptions={[15, 30, 60]}
          slotProps={{
            toolbar: {
              onDeleteSelected: handleBulkDelete,
              quickFilterPlaceholder: "Search rides",
            },
          }}
          density="compact"
          autoHeight={false}
          sx={{ minHeight: 420 }}
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
          collectionName="claimedRides"
          ride={editRow}
        />
      )}
    </>
  );
}
