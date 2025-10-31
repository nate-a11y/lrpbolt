import React, { useEffect, useState, useCallback, useMemo } from "react";
import { writeBatch, doc } from "firebase/firestore";
import { Button, Paper, Snackbar } from "@mui/material";

import logError from "@/utils/logError.js";
import AppError from "@/utils/AppError.js";
import { COLLECTIONS } from "@/constants.js";
import { TRIP_STATES } from "@/constants/tripStates.js";
import ConfirmBulkDeleteDialog from "@/components/datagrid/bulkDelete/ConfirmBulkDeleteDialog.jsx";
import useBulkDelete from "@/components/datagrid/bulkDelete/useBulkDelete.jsx";
import { moveQueuedToOpen, cancelRide } from "@/services/tripsService.js";
import {
  notifyRideEvent,
  playFeedbackSound,
} from "@/services/notificationsService.js";
import { useTripsByState } from "@/hooks/useTripsByState.js";
import useStableCallback from "@/hooks/useStableCallback.js";
import useOptimisticOverlay from "@/hooks/useOptimisticOverlay.js";
import { db } from "@/services/firebase.js";

import { resolveTripId } from "../columns/rideColumns.jsx";
import { deleteRide } from "../services/firestoreService";

import RideCardGrid from "./rides/RideCardGrid.jsx";
import QueueRideCard from "./rides/QueueRideCard.jsx";
import EditRideDialog from "./EditRideDialog.jsx";

export default function RideQueueGrid() {
  const [editRow, setEditRow] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
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

  const handleDelete = useCallback(
    async (ride) => {
      const id = getRowId(ride);
      if (!id) return;
      try {
        await deleteRide(COLLECTIONS.RIDE_QUEUE, id);
      } catch (err) {
        logError(err, { where: "RideQueueGrid.handleDelete", rideId: id });
        setSnack({ message: "Delete failed" });
      }
    },
    [getRowId],
  );

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

  const performRestore = useCallback(async (rowsToRestore) => {
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
  }, []);

  const { dialogOpen, deleting, openDialog, closeDialog, onConfirm } =
    useBulkDelete({ performDelete, performRestore });

  const handleBulkDelete = useCallback(
    async (ids) => {
      const rowsToDelete = ids
        .map((id) => rows.find((r) => getRowId(r) === id))
        .filter(Boolean);
      openDialog(ids, rowsToDelete);
    },
    [rows, getRowId, openDialog],
  );

  const sampleRows = useMemo(() => {
    return rows.filter((r) => r?.id);
  }, [rows]);

  const renderCard = useCallback(
    ({ ride, selected, onSelect }) => {
      const rideId = getRowId(ride);
      const isMoving = rideId ? pendingMoves.has(rideId) : false;

      return (
        <QueueRideCard
          key={rideId}
          ride={ride}
          selected={selected}
          onSelect={onSelect}
          onMoveToLive={handleMoveToLive}
          onEdit={handleEditRide}
          onDelete={handleDelete}
          moving={isMoving}
        />
      );
    },
    [getRowId, handleDelete, handleEditRide, handleMoveToLive, pendingMoves],
  );

  return (
    <>
      <Paper sx={{ width: "100%", p: 2 }}>
        <RideCardGrid
          rides={rows}
          renderCard={renderCard}
          loading={loading}
          error={error}
          onBulkDelete={handleBulkDelete}
          searchPlaceholder="Search queued rides..."
          title="Ride Queue"
          emptyMessage="No queued rides"
          pageSize={12}
        />
        <ConfirmBulkDeleteDialog
          open={dialogOpen}
          total={sampleRows.length}
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
