/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState } from "react";
import { Box, IconButton, Snackbar, Alert, Tooltip } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  subscribeClaimedRides,
  deleteClaimedRide,
  restoreRide,
} from "../hooks/api";
import EditableRideGrid from "../components/EditableRideGrid";
import { normalizeDate, normalizeTime } from "../timeUtils";
import {
  Dialog,
  Typography,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import useToast from "../hooks/useToast";

const LiveClaimGrid = () => {
  const [rows, setRows] = useState([]);
  const { toast, showToast, closeToast } = useToast("success");
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingTripID, setDeletingTripID] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [undoRow, setUndoRow] = useState(null);

  // ✅ Subscribe to claimed rides
  useEffect(() => {
    const unsubscribe = subscribeClaimedRides((data) => {
      const mapped = data.map((row) => ({
        id: row.TripID,
        ...row,
        Date: normalizeDate(row.Date),
        PickupTime: normalizeTime(row.PickupTime),
      }));
      setRows(mapped);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    const target = rows.find((r) => r.TripID === deletingTripID);
    setUndoRow(target);
    setRows((prev) =>
      prev.map((row) =>
        row.TripID === deletingTripID ? { ...row, fading: true } : row,
      ),
    );
    setTimeout(async () => {
      const res = await deleteClaimedRide(deletingTripID);
      if (res.success) {
        setRows((prev) => prev.filter((row) => row.TripID !== deletingTripID));
        showToast(`🗑️ Deleted Trip ${deletingTripID}`, "info");
      } else {
        setRows((prev) =>
          prev.map((row) =>
            row.TripID === deletingTripID ? { ...row, fading: false } : row,
          ),
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
    await restoreRide(undoRow);
    setUndoRow(null);
    showToast("✅ Ride restored", "success");
  };

  return (
    <Box>
      <Box display="flex" justifyContent="flex-end" alignItems="center" mb={1}>
        <Tooltip title="Real-time updates enabled">
          <span>
            <IconButton
              onClick={() => showToast("🔥 Real-time updates active", "info")}
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
          setDeletingTripID(TripID);
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

export default LiveClaimGrid;
