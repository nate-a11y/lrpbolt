import React, { useEffect, useState, useCallback, useMemo } from "react";
import { writeBatch, doc } from "firebase/firestore";
import { Button, Paper, Snackbar } from "@mui/material";
import { GridActionsCellItem, useGridApiRef } from "@mui/x-data-grid-pro";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";

import logError from "@/utils/logError.js";
import AppError from "@/utils/AppError.js";
import { COLLECTIONS } from "@/constants.js";
import { TRIP_STATES } from "@/constants/tripStates.js";
import ConfirmBulkDeleteDialog from "@/components/datagrid/bulkDelete/ConfirmBulkDeleteDialog.jsx";
import useBulkDelete from "@/components/datagrid/bulkDelete/useBulkDelete.jsx";
import { vfDurationHM, vfText, vfTime } from "@/utils/vf.js";
import { moveQueuedToOpen, cancelRide } from "@/services/tripsService.js";
import {
  notifyRideEvent,
  playFeedbackSound,
} from "@/services/notificationsService.js";
import { useTripsByState } from "@/hooks/useTripsByState.js";
import useStableCallback from "@/hooks/useStableCallback.js";
import useOptimisticOverlay from "@/hooks/useOptimisticOverlay.js";
import { db } from "@/services/firebase.js";

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

import SmartDataGrid from "./SmartDataGrid.jsx";
import EditRideDialog from "./EditRideDialog.jsx";

export default function RideQueueGrid() {
  const [editRow, setEditRow] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const apiRef = useGridApiRef();
  const [selectionModel, setSelectionModel] = useState([]);
  const [snack, setSnack] = useState(null);
  const [pendingMoves, setPendingMoves] = useState(() => new Set());
  const {
    rows: subscribedRows,
    loading,
    error,
  } = useTripsByState(TRIP_STATES.QUEUED);

  const getRowId = useStableCallback((row) => row?.id ?? null);

  const resolveRideDocumentId = useStableCallback((row) => {
    if (!row || typeof row !== "object") return null;
    const raw = row?._raw && typeof row._raw === "object" ? row._raw : {};

    const coerceId = (value) => {
      if (value == null) return null;
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
      }
      return null;
    };

    return (
      coerceId(resolveTripId(null, row)) ??
      coerceId(raw?.rideId) ??
      coerceId(raw?.rideID) ??
      coerceId(raw?.RideId) ??
      coerceId(raw?.RideID) ??
      coerceId(row?.rideId) ??
      coerceId(row?.rideID) ??
      coerceId(row?.RideId) ??
      coerceId(row?.RideID) ??
      coerceId(raw?.id) ??
      coerceId(row?.tripId) ??
      coerceId(row?.tripID) ??
      coerceId(row?.TripId) ??
      coerceId(row?.TripID) ??
      coerceId(row?.id) ??
      null
    );
  });

  const {
    rows: rowsWithOverlay,
    applyPatch,
    clearPatch,
    getPatch,
  } = useOptimisticOverlay(subscribedRows, getRowId);

  const rows = rowsWithOverlay;

  useEffect(() => {
    if (!Array.isArray(subscribedRows) || subscribedRows.length === 0) {
      return;
    }
    subscribedRows.forEach((row) => {
      const id = getRowId(row);
      if (!id) return;
      const patch = getPatch(id);
      if (!patch) return;
      const raw = row?._raw;
      const matches = Object.entries(patch).every(([key, value]) => {
        const rowValue = row?.[key];
        const rawValue = raw?.[key];
        return rowValue === value || rawValue === value;
      });
      if (matches) {
        clearPatch(id);
      }
    });
  }, [subscribedRows, clearPatch, getPatch, getRowId]);

  useEffect(() => {
    if (!error) return;
    logError(error, { where: "RideQueueGrid.subscription" });
  }, [error]);

  const markPending = useCallback((rideId) => {
    if (!rideId) return;
    setPendingMoves((prev) => {
      if (prev.has(rideId)) return prev;
      const next = new Set(prev);
      next.add(rideId);
      return next;
    });
  }, []);

  const clearPending = useCallback((rideId) => {
    if (!rideId) return;
    setPendingMoves((prev) => {
      if (!prev.has(rideId)) return prev;
      const next = new Set(prev);
      next.delete(rideId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (window?.__GRID_DEBUG__) {
      // eslint-disable-next-line no-console
      console.log("[RideQueueGrid sample]", rows?.[0]);
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

  const handleMoveToLive = useStableCallback(async (row) => {
    const queueId = getRowId(row);
    const rideDocId = resolveRideDocumentId(row);

    if (!queueId || !rideDocId) {
      const err = new Error("Missing ride identifiers");
      logError(err, {
        where: "RideQueueGrid.handleMoveToLive.init",
        queueId,
        rideId: rideDocId,
      });
      const message = !rideDocId
        ? "Ride id missing"
        : "Ride is missing queue reference";
      setSnack({ message });
      return;
    }

    markPending(queueId);

    applyPatch(queueId, {
      status: TRIP_STATES.OPEN,
      state: TRIP_STATES.OPEN,
      queueStatus: TRIP_STATES.OPEN,
      QueueStatus: TRIP_STATES.OPEN,
    });

    const userId = row?._raw?.updatedBy ?? row?.updatedBy ?? "system";
    setSnack({
      message: "Moved to Live",
      action: "undo",
      rideId: rideDocId,
      queueId,
    });

    try {
      await moveQueuedToOpen(rideDocId, { userId, queueId });
      await notifyRideEvent("live", { rideId: rideDocId, userId });
      playFeedbackSound();
    } catch (err) {
      clearPatch(queueId);
      logError(err, {
        where: "RideQueueGrid.handleMoveToLive",
        rideId: rideDocId,
        queueId,
      });
      setSnack({
        message: err?.message
          ? `Failed to move: ${err.message}`
          : "Failed to move ride",
      });
    } finally {
      clearPending(queueId);
    }
  });

  const handleUndo = useStableCallback(async (rideId, queueId) => {
    if (!rideId || !queueId) return;

    markPending(queueId);
    try {
      clearPatch(queueId);
      await cancelRide(rideId, TRIP_STATES.OPEN, {
        reason: "queue-move-undo",
        userId: "system",
      });
      setSnack({ message: "Move undone" });
    } catch (err) {
      logError(err, {
        where: "RideQueueGrid.handleUndo",
        rideId,
        queueId,
      });
      setSnack({
        message: err?.message ? `Undo failed: ${err.message}` : "Undo failed",
        action: "undo",
        rideId,
        queueId,
      });
    } finally {
      clearPending(queueId);
    }
  });

  const handleSnackClose = useCallback(
    (_event, reason) => {
      if (reason === "clickaway") return;
      if (snack?.queueId && snack?.action !== "undo") {
        clearPatch(snack.queueId);
      }
      setSnack(null);
    },
    [clearPatch, snack],
  );

  const performDelete = useCallback(async (ids) => {
    const backoff = (a) => new Promise((res) => setTimeout(res, 2 ** a * 100));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const batch = writeBatch(db);
        ids.forEach((id) => batch.delete(doc(db, COLLECTIONS.RIDE_QUEUE, id)));
        await batch.commit();
        return;
      } catch (err) {
        if (attempt === 2) {
          logError(err, { where: "RideQueueGrid", action: "bulkDelete" });
          throw new AppError(
            err.message || "Bulk delete failed",
            "FIRESTORE_DELETE",
            { collection: COLLECTIONS.RIDE_QUEUE },
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
          const { id, _raw, ...rest } = r;
          const payload = {
            ...(typeof _raw === "object" && _raw ? _raw : rest),
            state: TRIP_STATES.QUEUED,
            status: rest?.status ?? _raw?.status ?? TRIP_STATES.QUEUED,
          };
          batch.set(doc(db, COLLECTIONS.RIDE_QUEUE, id), payload, {
            merge: true,
          });
        });
        await batch.commit();
        return;
      } catch (err) {
        if (attempt === 2) {
          logError(err, { where: "RideQueueGrid", action: "bulkRestore" });
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

  const actionsColumn = useMemo(
    () =>
      buildNativeActionsColumn({
        onEdit: (_id, row) => handleEditRide(row),
        onDelete: async (id) => await deleteRide(COLLECTIONS.RIDE_QUEUE, id),
      }),
    [handleEditRide],
  );

  const renderActions = useCallback(
    (params) => {
      const row = params?.row || {};
      const rideId = getRowId(row);
      const baseItems = actionsColumn.getActions?.(params) || [];
      const normalized = Array.isArray(baseItems)
        ? [...baseItems]
        : baseItems
          ? [baseItems]
          : [];

      const statusCandidate =
        row?.status ??
        row?.state ??
        row?._raw?.status ??
        row?._raw?.state ??
        row?.QueueStatus ??
        row?.queueStatus ??
        TRIP_STATES.QUEUED;
      const normalizedStatus =
        typeof statusCandidate === "string"
          ? statusCandidate.toLowerCase()
          : statusCandidate;

      const disableMove =
        !rideId ||
        pendingMoves.has(rideId) ||
        normalizedStatus !== TRIP_STATES.QUEUED;

      const actionItems = [
        <GridActionsCellItem
          key="move-to-live"
          icon={<PlayArrowRoundedIcon fontSize="small" />}
          label="Move to Live"
          onClick={() => handleMoveToLive(row)}
          disabled={disableMove}
          showInMenu={false}
        />,
        ...normalized,
      ];

      return <>{actionItems}</>;
    },
    [actionsColumn, getRowId, handleMoveToLive, pendingMoves],
  );

  const columns = useMemo(
    () => [
      {
        field: "tripId",
        headerName: "Trip ID",
        minWidth: 140,
        flex: 1,
        valueGetter: resolveTripId,
        valueFormatter: (value) => vfText(value, null, null, null, "N/A"),
      },
      {
        field: "pickupTime",
        headerName: "Pickup",
        minWidth: 160,
        flex: 1,
        valueGetter: resolvePickupTime,
        valueFormatter: vfTime,
      },
      {
        field: "rideDuration",
        headerName: "Duration",
        minWidth: 120,
        flex: 0.6,
        valueGetter: resolveRideDuration,
        valueFormatter: vfDurationHM,
      },
      {
        field: "rideType",
        headerName: "Type",
        minWidth: 120,
        flex: 0.7,
        valueGetter: resolveRideType,
        valueFormatter: (value) => vfText(value, null, null, null, "N/A"),
      },
      {
        field: "vehicle",
        headerName: "Vehicle",
        minWidth: 160,
        flex: 0.9,
        valueGetter: resolveVehicle,
        valueFormatter: (value) => vfText(value, null, null, null, "N/A"),
      },
      {
        field: "rideNotes",
        headerName: "Notes",
        minWidth: 180,
        flex: 1,
        valueGetter: resolveRideNotes,
        valueFormatter: (value) => vfText(value, null, null, null, "N/A"),
      },
      {
        field: "createdAt",
        headerName: "Created",
        minWidth: 160,
        flex: 0.9,
        valueGetter: resolveCreatedAt,
        valueFormatter: vfTime,
      },
      {
        field: "claimedBy",
        headerName: "Claimed By",
        minWidth: 140,
        flex: 0.8,
        valueGetter: resolveClaimedBy,
        valueFormatter: (value) => vfText(value, null, null, null, "N/A"),
      },
      {
        field: "claimedAt",
        headerName: "Claimed At",
        minWidth: 160,
        flex: 0.9,
        valueGetter: resolveClaimedAt,
        valueFormatter: vfTime,
      },
      {
        field: "status",
        headerName: "Status",
        minWidth: 120,
        flex: 0.7,
        valueGetter: resolveStatus,
        valueFormatter: (value) => vfText(value, null, null, null, "N/A"),
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
        <SmartDataGrid
          id="queue-grid"
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
          loading={loading}
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
      <Snackbar
        open={!!snack}
        message={snack?.message ?? ""}
        autoHideDuration={snack?.action === "undo" ? 5000 : 3500}
        onClose={handleSnackClose}
        action={
          snack?.action === "undo" && snack?.rideId && snack?.queueId ? (
            <Button
              size="small"
              onClick={() => handleUndo(snack.rideId, snack.queueId)}
              disabled={pendingMoves.has(snack.queueId)}
              aria-label="Undo move to Live"
            >
              Undo
            </Button>
          ) : null
        }
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
      {editOpen && (
        <EditRideDialog
          open={editOpen}
          onClose={handleEditClose}
          collectionName={COLLECTIONS.RIDE_QUEUE}
          ride={editRow}
        />
      )}
    </>
  );
}
