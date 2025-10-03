import React, { useEffect, useState, useCallback, useMemo } from "react";
import { collection, onSnapshot, writeBatch, doc } from "firebase/firestore";
import { Paper } from "@mui/material";
import { useGridApiRef } from "@mui/x-data-grid-pro";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";

import logError from "@/utils/logError.js";
import AppError from "@/utils/AppError.js";
import ConfirmBulkDeleteDialog from "@/components/datagrid/bulkDelete/ConfirmBulkDeleteDialog.jsx";
import useBulkDelete from "@/components/datagrid/bulkDelete/useBulkDelete.jsx";
import LrpDataGridPro from "@/components/datagrid/LrpDataGridPro";
import { normalizeRideArray } from "@/services/mappers/rides.js";

import { buildNativeActionsColumn } from "../columns/nativeActions.jsx";
import { deleteRide } from "../services/firestoreService";
import { db } from "../utils/firebaseInit";

import EditRideDialog from "./EditRideDialog.jsx";

dayjs.extend(utc);
dayjs.extend(tz);

const fmtTs = (ts) => {
  try {
    const d =
      ts && typeof ts?.toDate === "function" ? dayjs(ts.toDate()) : dayjs(ts);
    return d.isValid() ? d.tz(dayjs.tz.guess()).format("MMM D, h:mm A") : "—";
  } catch (error) {
    logError(error, { where: "RideGrids", action: "fmtTs" });
    return "—";
  }
};

export default function ClaimedRidesGrid() {
  const [rows, setRows] = useState([]);
  const [editRow, setEditRow] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const apiRef = useGridApiRef();
  const [selectionModel, setSelectionModel] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "claimedRides"),
      (snap) => setRows(normalizeRideArray(snap)),
      console.error,
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (window?.__GRID_DEBUG__) {
      console.log("[ClaimedRidesGrid sample]", rows?.[0]);
    }
  }, [rows]);

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
    if (row?.tripId != null) return String(row.tripId);
    if (row?.trip != null) return String(row.trip);
    return null;
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

  const actionsColumn = useMemo(
    () =>
      buildNativeActionsColumn({
        onEdit: (_id, row) => handleEditRide(row),
        onDelete: async (id) => await deleteRide("claimedRides", id),
      }),
    [handleEditRide],
  );

  const renderActions = useCallback(
    (params) => {
      const items = actionsColumn.getActions?.(params);
      if (!items || (Array.isArray(items) && items.length === 0)) return null;
      return <>{items}</>;
    },
    [actionsColumn],
  );

  const columns = useMemo(
    () => [
      {
        field: "tripId",
        headerName: "Trip ID",
        minWidth: 140,
        flex: 1,
        valueGetter: (p) =>
          p?.row?.tripId ?? p?.row?.rideId ?? p?.row?.trip ?? null,
        valueFormatter: (p) => (p?.value ? String(p.value) : "—"),
      },
      {
        field: "pickupTime",
        headerName: "Pickup",
        minWidth: 160,
        flex: 1,
        valueGetter: (p) =>
          p?.row?.pickupTime ?? p?.row?.pickupAt ?? p?.row?.pickup ?? null,
        valueFormatter: (p) => fmtTs(p?.value),
      },
      {
        field: "rideDuration",
        headerName: "Duration",
        minWidth: 120,
        flex: 0.6,
        valueGetter: (p) => p?.row?.rideDuration ?? p?.row?.duration ?? null,
        valueFormatter: (p) => (p?.value != null ? `${p.value} min` : "—"),
      },
      {
        field: "rideType",
        headerName: "Type",
        minWidth: 120,
        flex: 0.7,
        valueGetter: (p) => p?.row?.rideType ?? p?.row?.type ?? null,
        valueFormatter: (p) => p?.value || "—",
      },
      {
        field: "vehicle",
        headerName: "Vehicle",
        minWidth: 160,
        flex: 0.9,
        valueGetter: (p) =>
          p?.row?.vehicle ?? p?.row?.vehicleId ?? p?.row?.car ?? null,
        valueFormatter: (p) => p?.value || "—",
      },
      {
        field: "rideNotes",
        headerName: "Notes",
        minWidth: 180,
        flex: 1,
        valueGetter: (p) => p?.row?.rideNotes ?? p?.row?.notes ?? null,
        valueFormatter: (p) => p?.value || "—",
      },
      {
        field: "createdAt",
        headerName: "Created",
        minWidth: 160,
        flex: 0.9,
        valueGetter: (p) => p?.row?.createdAt ?? null,
        valueFormatter: (p) => fmtTs(p?.value),
      },
      {
        field: "claimedBy",
        headerName: "Claimed By",
        minWidth: 140,
        flex: 0.8,
        valueGetter: (p) => p?.row?.claimedBy ?? null,
        valueFormatter: (p) => p?.value || "—",
      },
      {
        field: "claimedAt",
        headerName: "Claimed At",
        minWidth: 160,
        flex: 0.9,
        valueGetter: (p) => p?.row?.claimedAt ?? null,
        valueFormatter: (p) => fmtTs(p?.value),
      },
      {
        field: "status",
        headerName: "Status",
        minWidth: 120,
        flex: 0.7,
        valueGetter: (p) => p?.row?.status ?? null,
        valueFormatter: (p) => p?.value || "—",
      },
      {
        field: "__actions",
        headerName: "Actions",
        minWidth: 120,
        sortable: false,
        renderCell: renderActions,
      },
    ],
    [renderActions],
  );

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
