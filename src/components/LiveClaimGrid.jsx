/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState, useMemo } from "react";
import { Box, IconButton, Snackbar, Alert, Tooltip } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { deleteLiveRide, restoreLiveRide } from "../hooks/api";
import useRides from "../hooks/useRides";
import EditableRideGrid from "../components/EditableRideGrid";
import { normalizeDate, normalizeTime } from "../utils/timeUtils";
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
  const [deletingId, setDeletingId] = useState("");
  const [deletingTripID, setDeletingTripID] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [undoRow, setUndoRow] = useState(null);

  const { liveRides, fetchRides } = useRides();

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
        await fetchRides();
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
    await fetchRides();
    setUndoRow(null);
    showToast("✅ Ride restored", "success");
  };

  return (
    <Box>
      <Box display="flex" justifyContent="flex-end" alignItems="center" mb={1}>
        <Tooltip title="Refresh Live Rides">
          <span>
            <IconButton
              onClick={async () => {
                setLoading(true);
                await fetchRides();
                setLoading(false);
                showToast("🔄 Live rides refreshed", "success");
              }}
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
