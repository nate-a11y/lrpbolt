import React, { useEffect, useCallback, useMemo, useState } from "react";
import { writeBatch, doc } from "firebase/firestore";
import { Button, Paper, Snackbar } from "@mui/material";
import { useGridApiRef } from "@mui/x-data-grid-pro";

import AppError from "@/utils/AppError.js";
import logError from "@/utils/logError.js";
import ConfirmBulkDeleteDialog from "@/components/datagrid/bulkDelete/ConfirmBulkDeleteDialog.jsx";
import useBulkDelete from "@/components/datagrid/bulkDelete/useBulkDelete.jsx";
import { TRIP_STATES } from "@/constants/tripStates.js";
import { useTripsByState } from "@/hooks/useTripsByState.js";
import useAuth from "@/hooks/useAuth.js";
import { getFlag } from "@/services/observability";
import { db } from "@/services/firebase.js";
import { driverClaimRide, undoDriverClaim } from "@/services/tripsService.js";
import {
  notifyRideEvent,
  playFeedbackSound,
} from "@/services/notificationsService.js";
import { vfDurationHM, vfText, vfTime } from "@/utils/vf.js";
import useStableCallback from "@/hooks/useStableCallback.js";
import useOptimisticOverlay from "@/hooks/useOptimisticOverlay.js";
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

import SmartDataGrid from "./SmartDataGrid.jsx";
import EditRideDialog from "./EditRideDialog.jsx";

export default function LiveRidesGrid() {
  const [editRow, setEditRow] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const apiRef = useGridApiRef();
  const [selectionModel, setSelectionModel] = useState([]);
  const { rows: baseRows, loading, error } = useTripsByState(TRIP_STATES.OPEN);
  const { user } = useAuth();
  const driverId = user?.uid ?? null;
  const [snack, setSnack] = useState(null);
  const [pendingClaims, setPendingClaims] = useState(() => new Set());
  const [undoPending, setUndoPending] = useState(false);
  const usersMap = useUsersMap();

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

  const performDelete = useCallback(async (ids) => {
    const backoff = (a) => new Promise((res) => setTimeout(res, 2 ** a * 100));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const batch = writeBatch(db);
        ids.forEach((id) => batch.delete(doc(db, "rides", id)));
        await batch.commit();
        return;
      } catch (err) {
        if (attempt === 2) {
          logError(err, { where: "LiveRidesGrid", action: "bulkDelete" });
          throw new AppError(
            err.message || "Bulk delete failed",
            "FIRESTORE_DELETE",
            { collection: "rides" },
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
          batch.set(doc(db, "rides", id), payload, { merge: true });
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
        onDelete: async (id) => await deleteRide("rides", id),
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

  const claimColumn = useMemo(
    () => ({
      field: "claimRide",
      headerName: "Claim",
      minWidth: 140,
      flex: 0.6,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const ride = params?.row || {};
        const rideId = ride?.id || params?.id;
        const isPending = rideId ? pendingClaims.has(rideId) : false;
        const alreadyClaimed = Boolean(
          ride?.claimedBy && ride.claimedBy !== driverId,
        );
        const disabled =
          !driverId ||
          isPending ||
          alreadyClaimed ||
          Boolean(ride?.disableClaim) ||
          loading;

        return (
          <Button
            size="small"
            variant="contained"
            color="primary"
            disabled={disabled}
            onClick={() => handleClaim(ride)}
            aria-label="Claim ride"
          >
            {alreadyClaimed ? "Claimed" : isPending ? "Claiming…" : "Claim"}
          </Button>
        );
      },
    }),
    [driverId, handleClaim, loading, pendingClaims],
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
      claimColumn,
      {
        field: "__actions",
        headerName: "Actions",
        minWidth: 120,
        sortable: false,
        renderCell: renderActions,
      },
    ],
    [claimColumn, deriveClaimedByDisplay, renderActions],
  );

  return (
    <>
      <Paper sx={{ width: "100%", display: "flex", flexDirection: "column" }}>
        <SmartDataGrid
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
          collectionName="rides"
          ride={editRow}
        />
      )}
    </>
  );
}
