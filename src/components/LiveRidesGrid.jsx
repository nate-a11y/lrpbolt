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
import { getFlag } from "@/services/observability";

import { buildNativeActionsColumn } from "../columns/nativeActions.jsx";
import { deleteRide } from "../services/firestoreService";
import { db } from "../utils/firebaseInit";

import EditRideDialog from "./EditRideDialog.jsx";

dayjs.extend(utc);
dayjs.extend(tz);

function formatTs(ts) {
  try {
    const d =
      ts && typeof ts?.toDate === "function" ? dayjs(ts.toDate()) : dayjs(ts);
    return d.isValid() ? d.tz(dayjs.tz.guess()).format("MMM D, h:mm A") : "—";
  } catch (error) {
    logError(error, { where: "LiveRidesGrid", action: "formatTs" });
    return "—";
  }
}

export default function LiveRidesGrid() {
  const [rows, setRows] = useState([]);
  const [editRow, setEditRow] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const apiRef = useGridApiRef();
  const [selectionModel, setSelectionModel] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "liveRides"),
      (snap) => setRows(normalizeRideArray(snap)),
      console.error,
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!getFlag || !getFlag("grid.debug")) {
      return;
    }
    const sample = Array.isArray(rows) ? rows[0] : null;
    console.log("[GridDebug:LiveRides] row0", sample);
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

  const getRowId = useCallback((row) => {
    if (row?.id != null) return String(row.id);
    if (row?.rideId != null) return String(row.rideId);
    return null;
  }, []);

  const formatMinutes = useCallback((raw) => {
    const minutes = Number(raw);
    if (!Number.isFinite(minutes) || minutes <= 0) return "—";
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
          claimedBy: false,
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
        flex: 1,
        valueFormatter: (params) => {
          const value = params?.value;
          return value == null || value === "" ? "—" : String(value);
        },
      },
      {
        field: "pickupTime",
        headerName: "Pickup",
        minWidth: 160,
        flex: 1,
        valueFormatter: (params) => formatTs(params?.value),
      },
      {
        field: "rideDuration",
        headerName: "Duration",
        minWidth: 120,
        flex: 0.7,
        valueFormatter: (params) => formatMinutes(params?.value),
      },
      {
        field: "rideType",
        headerName: "Type",
        minWidth: 120,
        flex: 0.7,
        valueFormatter: (params) => {
          const value = params?.value;
          return value == null || value === "" ? "—" : String(value);
        },
      },
      {
        field: "vehicle",
        headerName: "Vehicle",
        minWidth: 140,
        flex: 0.9,
        valueFormatter: (params) => {
          const value = params?.value;
          return value == null || value === "" ? "—" : String(value);
        },
      },
      {
        field: "rideNotes",
        headerName: "Notes",
        minWidth: 180,
        flex: 1.4,
        valueFormatter: (params) => {
          const value = params?.value;
          return value == null || value === "" ? "—" : String(value);
        },
      },
      {
        field: "createdAt",
        headerName: "Created",
        minWidth: 180,
        flex: 1,
        valueFormatter: (params) => formatTs(params?.value),
      },
      {
        field: "claimedBy",
        headerName: "Claimed By",
        minWidth: 160,
        flex: 1,
        valueFormatter: (params) => {
          const value = params?.value;
          return value == null || value === "" ? "—" : String(value);
        },
      },
      {
        field: "claimedAt",
        headerName: "Claimed At",
        minWidth: 180,
        flex: 1,
        valueFormatter: (params) => formatTs(params?.value),
      },
      {
        field: "status",
        headerName: "Status",
        minWidth: 140,
        flex: 0.8,
        valueFormatter: (params) => {
          const value = params?.value;
          return value == null || value === "" ? "—" : String(value);
        },
      },
    ];

    const actionsColumn = buildNativeActionsColumn({
      onEdit: (_id, row) => handleEditRide(row),
      onDelete: async (id) => await deleteRide("liveRides", id),
    });

    return [...baseColumns, actionsColumn];
  }, [formatMinutes, handleEditRide]);

  return (
    <>
      <Paper sx={{ width: "100%", display: "flex", flexDirection: "column" }}>
        <LrpDataGridPro
          id="live-grid"
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
          collectionName="liveRides"
          ride={editRow}
        />
      )}
    </>
  );
}
