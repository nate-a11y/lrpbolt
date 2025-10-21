import React, { useEffect, useState, useCallback, useMemo } from "react";
import { collection, onSnapshot, writeBatch, doc } from "firebase/firestore";
import { Paper } from "@mui/material";
import { useGridApiRef } from "@mui/x-data-grid-pro";

import logError from "@/utils/logError.js";
import AppError from "@/utils/AppError.js";
import ConfirmBulkDeleteDialog from "@/components/datagrid/bulkDelete/ConfirmBulkDeleteDialog.jsx";
import useBulkDelete from "@/components/datagrid/bulkDelete/useBulkDelete.jsx";
import LrpDataGridPro from "@/components/datagrid/LrpDataGridPro";
import { normalizeRideArray } from "@/utils/normalizeRide.js";
import { vfDurationHM, vfText, vfTime } from "@/utils/vf.js";
import useUsersMap from "@/hooks/useUsersMap.js";

import { buildNativeActionsColumn } from "../columns/nativeActions.jsx";
import {
  resolveClaimedAt,
  resolveClaimedBy,
  resolveCreatedAt,
  resolvePickupTime,
  resolveRideDuration,
  resolveRideNotes,
  resolveRideType,
  resolveStatus,
  resolveTripId,
  resolveVehicle,
} from "../columns/rideColumns.jsx";
import { deleteRide } from "../services/firestoreService";
import { db } from "../utils/firebaseInit";

import EditRideDialog from "./EditRideDialog.jsx";

export default function ClaimedRidesGrid() {
  const [rows, setRows] = useState([]);
  const [editRow, setEditRow] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const apiRef = useGridApiRef();
  const [selectionModel, setSelectionModel] = useState([]);
  const usersMap = useUsersMap();

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "claimedRides"),
      (snap) => setRows(normalizeRideArray(snap.docs)),
      (err) => {
        logError(err, {
          where: "ClaimedRidesGrid",
          action: "loadClaimedRides",
        });
      },
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

  const deriveClaimedByDisplay = useMemo(
    () => (params) => {
      const row = params?.row || {};
      const raw = row?._raw || {};

      const directName =
        row?.claimedByName || raw?.claimedByName || raw?.ClaimedByName || null;
      if (directName) return directName;

      const resolved = resolveClaimedBy(params);
      if (resolved && typeof resolved === "object") {
        const objectName =
          resolved?.displayName ||
          resolved?.name ||
          resolved?.fullName ||
          resolved?.email ||
          null;
        if (objectName) return objectName;
      }

      const resolvedString =
        typeof resolved === "string" && resolved.trim() !== ""
          ? resolved.trim()
          : null;

      const candidateUid =
        resolvedString ||
        row?.claimedBy ||
        raw?.claimedBy ||
        raw?.ClaimedBy ||
        row?.ClaimedBy ||
        null;

      if (candidateUid) {
        const uid = String(candidateUid).trim();
        if (uid && usersMap[uid]) {
          return usersMap[uid];
        }
        return uid || null;
      }

      return null;
    },
    [usersMap],
  );

  const columns = useMemo(
    () => [
      {
        field: "tripId",
        headerName: "Trip ID",
        minWidth: 140,
        flex: 1,
        valueGetter: (params) => resolveTripId(params),
        valueFormatter: (params) => vfText(params, "N/A"),
      },
      {
        field: "pickupTime",
        headerName: "Pickup",
        minWidth: 160,
        flex: 1,
        valueGetter: (params) => resolvePickupTime(params),
        valueFormatter: vfTime,
      },
      {
        field: "rideDuration",
        headerName: "Duration",
        minWidth: 120,
        flex: 0.6,
        valueGetter: (params) => resolveRideDuration(params),
        valueFormatter: vfDurationHM,
      },
      {
        field: "rideType",
        headerName: "Type",
        minWidth: 120,
        flex: 0.7,
        valueGetter: (params) => resolveRideType(params),
        valueFormatter: (params) => vfText(params, "N/A"),
      },
      {
        field: "vehicle",
        headerName: "Vehicle",
        minWidth: 160,
        flex: 0.9,
        valueGetter: (params) => resolveVehicle(params),
        valueFormatter: (params) => vfText(params, "N/A"),
      },
      {
        field: "rideNotes",
        headerName: "Notes",
        minWidth: 180,
        flex: 1,
        valueGetter: (params) => resolveRideNotes(params),
        valueFormatter: (params) => vfText(params, "N/A"),
      },
      {
        field: "createdAt",
        headerName: "Created",
        minWidth: 160,
        flex: 0.9,
        valueGetter: (params) => resolveCreatedAt(params),
        valueFormatter: vfTime,
      },
      {
        field: "claimedBy",
        headerName: "Claimed By",
        minWidth: 140,
        flex: 0.8,
        valueGetter: (params) => deriveClaimedByDisplay(params),
        renderCell: (params) => deriveClaimedByDisplay(params) || "N/A",
        valueFormatter: (params) => vfText(params, "N/A"),
      },
      {
        field: "claimedAt",
        headerName: "Claimed At",
        minWidth: 160,
        flex: 0.9,
        valueGetter: (params) => resolveClaimedAt(params),
        valueFormatter: vfTime,
      },
      {
        field: "status",
        headerName: "Status",
        minWidth: 120,
        flex: 0.7,
        valueGetter: (params) => resolveStatus(params),
        valueFormatter: (params) => vfText(params, "N/A"),
      },
      {
        field: "__actions",
        headerName: "Actions",
        minWidth: 120,
        sortable: false,
        renderCell: renderActions,
      },
    ],
    [deriveClaimedByDisplay, renderActions],
  );

  return (
    <>
      <Paper sx={{ width: "100%", display: "flex", flexDirection: "column" }}>
        <LrpDataGridPro
          id="claimed-grid"
          rows={rows}
          columns={columns}
          getRowId={(row) => row?.id ?? null}
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
