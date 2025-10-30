import React, { useEffect, useCallback, useMemo, useState } from "react";
import { writeBatch, doc } from "firebase/firestore";
import { Button, Paper, Snackbar } from "@mui/material";

import AppError from "@/utils/AppError.js";
import logError from "@/utils/logError.js";
import ConfirmBulkDeleteDialog from "@/components/datagrid/bulkDelete/ConfirmBulkDeleteDialog.jsx";
import useBulkDelete from "@/components/datagrid/bulkDelete/useBulkDelete.jsx";
import { COLLECTIONS } from "@/constants.js";
import { TRIP_STATES } from "@/constants/tripStates.js";
import { useTripsByState } from "@/hooks/useTripsByState.js";
import useAuth from "@/hooks/useAuth.js";
import { db } from "@/services/firebase.js";
import { driverClaimRide, undoDriverClaim } from "@/services/tripsService.js";
import {
  notifyRideEvent,
  playFeedbackSound,
} from "@/services/notificationsService.js";
import useStableCallback from "@/hooks/useStableCallback.js";
import useOptimisticOverlay from "@/hooks/useOptimisticOverlay.js";

import { deleteRide } from "../services/firestoreService";

import RideCardGrid from "./rides/RideCardGrid.jsx";
import LiveRideCard from "./rides/LiveRideCard.jsx";
import EditRideDialog from "./EditRideDialog.jsx";

export default function LiveRidesGrid() {
  const [editRow, setEditRow] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const { rows: baseRows, loading, error } = useTripsByState(TRIP_STATES.OPEN);
  const { user } = useAuth();
  const driverId = user?.uid ?? null;
  const [snack, setSnack] = useState(null);
  const [pendingClaims, setPendingClaims] = useState(() => new Set());
  const [undoPending, setUndoPending] = useState(false);

  const getRowId = useStableCallback((row) => row?.id || row?.rideId || null);
  const {
    rows: rowsWithOverlay,
    applyPatch,
    clearPatch,
    getPatch,
  } = useOptimisticOverlay(baseRows, getRowId);
  const rows = rowsWithOverlay;

  useEffect(() => {
    if (!error) return;
    logError(error, { where: "LiveRidesGrid.subscription" });
  }, [error]);

  useEffect(() => {
    if (!Array.isArray(baseRows) || baseRows.length === 0) {
      return;
    }
    baseRows.forEach((row) => {
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
  }, [baseRows, clearPatch, getPatch, getRowId]);

  const handleEditRide = useCallback((row) => {
    setEditRow(row);
    setEditOpen(true);
  }, []);

  const handleEditClose = useCallback(() => {
    setEditOpen(false);
    setEditRow(null);
  }, []);

  const handleClaim = useStableCallback(async (ride) => {
    const rideId = ride?.id || ride?.rideId;
    if (!rideId) return;

    if (!driverId) {
      setSnack({ msg: "Sign in required to claim rides" });
      return;
    }

    setPendingClaims((prev) => {
      const next = new Set(prev);
      next.add(rideId);
      return next;
    });

    applyPatch(rideId, {
      state: TRIP_STATES.CLAIMED,
      claimedBy: driverId,
    });

    try {
      await driverClaimRide(rideId, driverId, {
        userId: driverId,
        vehicleId: ride?.vehicleId ?? ride?.vehicle?.id ?? null,
      });
      await notifyRideEvent("claim", { rideId, driverId });
      playFeedbackSound();
      setSnack({ msg: "Ride claimed", rideId, driverId });
    } catch (err) {
      clearPatch(rideId);
      logError(err, { where: "LiveRidesGrid.handleClaim", rideId });
      const message = err?.message
        ? `Claim failed: ${err.message}`
        : "Claim failed";
      setSnack({ msg: message });
    } finally {
      setPendingClaims((prev) => {
        const next = new Set(prev);
        next.delete(rideId);
        return next;
      });
    }
  });

  const handleUndo = useStableCallback(async (rideId, claimedDriverId) => {
    if (!rideId || !claimedDriverId) {
      setSnack(null);
      return;
    }

    setUndoPending(true);
    try {
      clearPatch(rideId);
      await undoDriverClaim(rideId, claimedDriverId, {
        userId: claimedDriverId,
      });
      setSnack({ msg: "Claim reverted" });
    } catch (err) {
      logError(err, { where: "LiveRidesGrid.handleUndo", rideId });
      const message = err?.message
        ? `Undo failed: ${err.message}`
        : "Undo failed";
      setSnack({ msg: message });
    } finally {
      setUndoPending(false);
    }
  });

  const handleDelete = useCallback(
    async (ride) => {
      const id = getRowId(ride);
      if (!id) return;
      try {
        await deleteRide(COLLECTIONS.LIVE_RIDES, id);
      } catch (err) {
        logError(err, { where: "LiveRidesGrid.handleDelete", rideId: id });
        setSnack({ msg: "Delete failed" });
      }
    },
    [getRowId],
  );

  const performDelete = useCallback(async (ids) => {
    const backoff = (a) => new Promise((res) => setTimeout(res, 2 ** a * 100));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const batch = writeBatch(db);
        ids.forEach((id) => batch.delete(doc(db, COLLECTIONS.LIVE_RIDES, id)));
        await batch.commit();
        return;
      } catch (err) {
        if (attempt === 2) {
          logError(err, { where: "LiveRidesGrid", action: "bulkDelete" });
          throw new AppError(
            err.message || "Bulk delete failed",
            "FIRESTORE_DELETE",
            { collection: COLLECTIONS.LIVE_RIDES },
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
            state: TRIP_STATES.OPEN,
            status: rest?.status ?? _raw?.status ?? TRIP_STATES.OPEN,
          };
          batch.set(doc(db, COLLECTIONS.LIVE_RIDES, id), payload, {
            merge: true,
          });
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
      const rowsToDelete = ids.map((id) => rows.find((r) => getRowId(r) === id)).filter(Boolean);
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
      const isPending = rideId ? pendingClaims.has(rideId) : false;

      return (
        <LiveRideCard
          key={rideId}
          ride={ride}
          selected={selected}
          onSelect={onSelect}
          onClaim={handleClaim}
          onEdit={handleEditRide}
          onDelete={handleDelete}
          claiming={isPending}
          driverId={driverId}
        />
      );
    },
    [driverId, getRowId, handleClaim, handleDelete, handleEditRide, pendingClaims],
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
          searchPlaceholder="Search live rides..."
          title="Live Rides"
          emptyMessage="No live rides available"
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
        <Snackbar
          open={Boolean(snack)}
          message={snack?.msg || ""}
          autoHideDuration={4000}
          onClose={(_, reason) => {
            if (reason === "clickaway") return;
            setSnack(null);
          }}
          action={
            snack?.rideId && snack?.driverId ? (
              <Button
                size="small"
                color="secondary"
                onClick={() => handleUndo(snack.rideId, snack.driverId)}
                disabled={undoPending}
              >
                {undoPending ? "Undoing…" : "Undo"}
              </Button>
            ) : null
          }
        />
      </Paper>
      {editOpen && (
        <EditRideDialog
          open={editOpen}
          onClose={handleEditClose}
          collectionName={COLLECTIONS.LIVE_RIDES}
          ride={editRow}
        />
      )}
    </>
  );
}
