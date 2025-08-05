/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState } from "react";
import { Box, Snackbar, Alert, IconButton, Tooltip } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { subscribeRideQueue, deleteRideFromQueue, addRideToQueue } from "../hooks/api";
import EditableRideGrid from "../components/EditableRideGrid";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";

const RideQueueGrid = () => {
  const [rows, setRows] = useState([]);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingTripId, setDeletingTripId] = useState(null);
  const [undoRow, setUndoRow] = useState(null);

  // ✅ Real-time Firestore subscription
  useEffect(() => {
    const unsubscribe = subscribeRideQueue((data) => {
      const mapped = data.map((row) => ({
        ...row,
        TripID: row.tripId || row.TripID || row.id,
      }));
      setRows(mapped);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ✅ Delete ride (Firestore)
  const confirmDeleteRide = async () => {
    if (!deletingId) return;
    const target = rows.find((r) => r.id === deletingId);
    setUndoRow(target);
    setRows((prev) =>
      prev.map((row) => (row.id === deletingId ? { ...row, fading: true } : row))
    );

    setTimeout(async () => {
      try {
        await deleteRideFromQueue(deletingId);
        setRows((prev) => prev.filter((row) => row.id !== deletingId));
        setToast({ open: true, message: `🗑️ Deleted Trip ${deletingTripId}`, severity: "info" });
      } catch (err) {
        setToast({ open: true, message: `❌ ${err.message}`, severity: "error" });
        setUndoRow(null);
      }
      setConfirmOpen(false);
      setDeletingId(null);
      setDeletingTripId(null);
    }, 300);
  };

  // ✅ Undo ride delete (Firestore)
  const handleUndo = async () => {
    if (!undoRow) return;
    await addRideToQueue(undoRow);
    setUndoRow(null);
    setToast({ open: true, message: "✅ Ride restored", severity: "success" });
  };

  return (
    <Box>
      <Box display="flex" justifyContent="flex-end" alignItems="center" mb={1}>
        <Tooltip title="Refresh Ride Queue (optional)">
          <span>
            <IconButton
              onClick={() => setToast({ open: true, message: "🔥 Real-time updates active", severity: "info" })}
              disabled={loading}
              aria-label="Refresh rides"
            >
              <RefreshIcon sx={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <EditableRideGrid
        rows={rows}
        loading={loading}
        onDelete={(id) => {
          const row = rows.find((r) => r.id === id);
          setDeletingId(id);
          setDeletingTripId(row?.TripID || "");
          setConfirmOpen(true);
        }}
        sheetName="rideQueue"
      />

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete Ride?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deletingTripId}</strong> from the Ride Queue?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteRide} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
      >
        <Alert
          onClose={() => setToast({ ...toast, open: false })}
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

export default RideQueueGrid;
