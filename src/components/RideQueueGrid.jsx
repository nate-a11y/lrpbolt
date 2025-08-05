/* Proprietary and confidential. See LICENSE. */
import React, { useCallback, useEffect, useState } from "react";
import { Box, Snackbar, Alert, IconButton, Tooltip } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { fetchRideQueue, deleteRide, restoreRide } from "../hooks/api";
import EditableRideGrid from "../components/EditableRideGrid";
import { normalizeDate, normalizeTime } from "../timeUtils";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";

const RideQueueGrid = ({ refreshTrigger }) => {
  const [rows, setRows] = useState([]);
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingTripId, setDeletingTripId] = useState(null);
  const [undoRow, setUndoRow] = useState(null);

  const refreshRides = useCallback(() => {
    setLoading(true);
    fetchRideQueue()
      .then((data) => {
        const mapped = data.map((row, i) => ({
          id: row.TripID,
          ...row,
          Date: normalizeDate(row.Date),
          PickupTime: normalizeTime(row.PickupTime),
        }));
        setRows(mapped);
      })
      .catch((err) => {
        setToast({
          open: true,
          message: `❌ Failed to load rides: ${err.message}`,
          severity: "error",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refreshRides();
  }, [refreshRides, refreshTrigger]);

  useEffect(() => {
    const id = setInterval(refreshRides, 60000);
    return () => clearInterval(id);
  }, [refreshRides]);

  const confirmDeleteRide = async () => {
    if (!deletingTripId) return;
    const target = rows.find((r) => r.TripID === deletingTripId);
    setUndoRow(target);
    setRows((prev) =>
      prev.map((row) =>
        row.TripID === deletingTripId ? { ...row, fading: true } : row,
      ),
    );
    setTimeout(async () => {
      const res = await deleteRide(deletingTripId, "RideQueue");
      if (res.success) {
        setRows((prev) => prev.filter((row) => row.TripID !== deletingTripId));
        setToast({
          open: true,
          message: `🗑️ Deleted Trip ${deletingTripId}`,
          severity: "info",
        });
      } else {
        setRows((prev) =>
          prev.map((row) =>
            row.TripID === deletingTripId ? { ...row, fading: false } : row,
          ),
        );
        setUndoRow(null);
        setToast({
          open: true,
          message: `❌ ${res.message}`,
          severity: "error",
        });
      }
      setConfirmOpen(false);
      setDeletingTripId(null);
    }, 300);
  };

  const handleUndo = async () => {
    if (!undoRow) return;
    await restoreRide(undoRow);
    setUndoRow(null);
    refreshRides();
    setToast({ open: true, message: "✅ Ride restored", severity: "success" });
  };

  return (
    <Box>
      <Box display="flex" justifyContent="flex-end" alignItems="center" mb={1}>
        <Tooltip title="Refresh Ride Queue">
          <span>
            <IconButton
              onClick={refreshRides}
              disabled={loading}
              aria-label="Refresh rides"
            >
              <RefreshIcon
                sx={{
                  animation: loading ? "spin 1s linear infinite" : "none",
                }}
              />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <EditableRideGrid
        rows={rows}
        loading={loading}
        onDelete={(TripID) => {
          setDeletingTripId(TripID);
          setConfirmOpen(true);
        }}
        refreshRides={refreshRides}
        sheetName="RideQueue"
      />
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete Ride?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deletingTripId}</strong>{" "}
            from the Ride Queue?
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
