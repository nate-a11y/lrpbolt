import React, { useEffect, useState, useCallback, useMemo } from "react";
import { collection, onSnapshot, writeBatch, doc } from "firebase/firestore";
import { Paper } from "@mui/material";

import logError from "@/utils/logError.js";
import AppError from "@/utils/AppError.js";
import ConfirmBulkDeleteDialog from "@/components/datagrid/bulkDelete/ConfirmBulkDeleteDialog.jsx";
import useBulkDelete from "@/components/datagrid/bulkDelete/useBulkDelete.jsx";
import { normalizeRideArray } from "@/utils/normalizeRide.js";

import { deleteRide } from "../services/firestoreService";
import { db } from "../utils/firebaseInit";

import RideCardGrid from "./rides/RideCardGrid.jsx";
import ClaimedRideCard from "./rides/ClaimedRideCard.jsx";
import EditRideDialog from "./EditRideDialog.jsx";

export default function ClaimedRidesGrid() {
  const [rows, setRows] = useState([]);
  const [editRow, setEditRow] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, "claimedRides"),
      (snap) => {
        setRows(normalizeRideArray(snap.docs));
        setLoading(false);
        setError(null);
      },
      (err) => {
        logError(err, {
          where: "ClaimedRidesGrid",
          action: "loadClaimedRides",
        });
        setError(err);
        setLoading(false);
      },
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

  const handleDelete = useCallback(async (ride) => {
    const id = ride?.id;
    if (!id) return;
    try {
      await deleteRide("claimedRides", id);
    } catch (err) {
      logError(err, { where: "ClaimedRidesGrid.handleDelete", rideId: id });
    }
  }, []);

  const handleBulkDelete = useCallback(
    async (ids) => {
      const rowsToDelete = ids
        .map((id) => rows.find((r) => r?.id === id))
        .filter(Boolean);
      openDialog(ids, rowsToDelete);
    },
    [rows, openDialog],
  );

  const sampleRows = useMemo(() => {
    return rows.filter((r) => r?.id);
  }, [rows]);

  const renderCard = useCallback(
    ({ ride, selected, onSelect }) => {
      return (
        <ClaimedRideCard
          key={ride.id}
          ride={ride}
          selected={selected}
          onSelect={onSelect}
          onEdit={handleEditRide}
          onDelete={handleDelete}
        />
      );
    },
    [handleEditRide, handleDelete],
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
          searchPlaceholder="Search claimed rides..."
          title="Claimed Rides"
          emptyMessage="No claimed rides"
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
