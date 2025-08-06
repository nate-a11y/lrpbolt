/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Snackbar,
  Alert,
  Dialog,
  Typography,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import { orderBy } from "firebase/firestore";
import { deleteLiveRide, restoreLiveRide } from "../hooks/api";
import useFirestoreListener from "../hooks/useFirestoreListener";
import EditableRideGrid from "../components/EditableRideGrid";
import { normalizeDate, normalizeTime } from "../utils/timeUtils";
import useToast from "../hooks/useToast";

const LiveClaimGrid = () => {
  const [rows, setRows] = useState([]);
  const { toast, showToast, closeToast } = useToast("success");
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [deletingTripID, setDeletingTripID] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [undoRow, setUndoRow] = useState(null);

  const liveRides = useFirestoreListener("liveRides", [
    orderBy("pickupTime", "asc"),
  ]);

  const mapped = useMemo(
    () =>
      liveRides.map((row) => ({
        ...row,
        TripID: row.tripId || row.TripID || row.id,
        Date: normalizeDate(row.Date),
        PickupTime: normalizeTime(row.PickupTime),
      })),
    [liveRides],
  );

  // ✅ Update rows from shared hook
  useEffect(() => {
    setRows(mapped);
    setLoading(false);
  }, [mapped]);

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    const target = rows.find((r) => r.id === deletingId);
    setUndoRow(target);
    setRows((prev) =>
      prev.map((row) => (row.id === deletingId ? { ...row, fading: true } : row)),
    );
    setTimeout(async () => {
      const res = await deleteLiveRide(deletingId);
      if (res.success) {
        setRows((prev) => prev.filter((row) => row.id !== deletingId));
        showToast(`🗑️ Deleted Trip ${deletingTripID}`, "info");
      } else {
        setRows((prev) =>
          prev.map((row) => (row.id === deletingId ? { ...row, fading: false } : row)),
        );
        setUndoRow(null);
        showToast(`❌ ${res.message}`, "error");
      }
      setDeleting(false);
      setConfirmOpen(false);
    }, 300);
  };

  const handleUndo = async () => {
    if (!undoRow) return;
    await restoreLiveRide(undoRow);
    setUndoRow(null);
    showToast("✅ Ride restored", "success");
  };

  return (
    <Box>
      <EditableRideGrid
        rows={rows}
        loading={loading}
        onDelete={(id) => {
          const row = rows.find((r) => r.id === id);
          setDeletingId(id);
          setDeletingTripID(row?.TripID || "");
          setConfirmOpen(true);
        }}
        sheetName="Sheet1"
      />
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete Ride?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deletingTripID}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirmed}
            variant="contained"
            color="error"
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={closeToast}>
        <Alert
          onClose={closeToast}
          severity={toast.severity}
          variant="filled"
          action={
            undoRow && (
              <Button color="inherit" size="small" onClick={handleUndo}>
                UNDO
              </Button>
            )
          }
        >
          {toast.message}
        </Alert>
      </Snackbar>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </Box>
  );
};

export default React.memo(LiveClaimGrid);
