/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState, memo } from "react";
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

import {
  subscribeRides,
  deleteRide,
  updateRide,
  getRides,
} from "../services/firestoreService";
import EditableRideGrid from "../components/EditableRideGrid";
import useToast from "../hooks/useToast";
import { safe } from "../utils/rideFormatters";
import { useAuth } from "../context/AuthContext.jsx";
import { COLLECTIONS } from "../constants";
import { logError } from "../utils/logError";
import { shapeRideRow } from "../services/shapeRideRow";

import EditRideDialog from "./EditRideDialog";

const LiveRidesGrid = () => {
  const [rows, setRows] = useState([]);
  const { toast, showToast, closeToast } = useToast("success");
  const [loading, setLoading] = useState(true);
  const { user, authLoading } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [deletingTripId, setDeletingTripId] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [undoRow, setUndoRow] = useState(null);
  const [editing, setEditing] = useState({ open: false, row: null });

  function openEdit(row) {
    setEditing({ open: true, row });
  }

  function closeEdit(didSave) {
    setEditing({ open: false, row: null });
    if (didSave) refreshRides();
  }

  useEffect(() => {
    if (authLoading || !user?.email) return;
    const unsub = subscribeRides(
      COLLECTIONS.LIVE_RIDES,
      (data) => {
        const rows = data.map((r) => shapeRideRow({ id: r.id, data: () => r }));
        setRows(rows);
        setLoading(false);
      },
      () => {
        showToast("Permissions issue loading live rides", "error");
        setLoading(false);
      },
    );
    return unsub;
  }, [authLoading, user?.email, showToast]);

    async function refreshRides() {
      setLoading(true);
      const data = await getRides(COLLECTIONS.LIVE_RIDES);
      const rows = data.map((r) => shapeRideRow({ id: r.id, data: () => r }));
      setRows(rows);
      setLoading(false);
    }

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    const target = rows.find((r) => r.id === deletingId);
    setUndoRow(target);
    setRows((prev) =>
      prev.map((row) =>
        row.id === deletingId ? { ...row, fading: true } : row,
      ),
    );
    setTimeout(async () => {
      try {
        await deleteRide(COLLECTIONS.LIVE_RIDES, deletingId);
        setRows((prev) => prev.filter((row) => row.id !== deletingId));
        showToast(`🗑️ Deleted Trip ${safe(deletingTripId, "")}`, "info");
      } catch (err) {
        setRows((prev) =>
          prev.map((row) =>
            row.id === deletingId ? { ...row, fading: false } : row,
          ),
        );
        setUndoRow(null);
        logError(err, "LiveRidesGrid:delete");
        showToast(`❌ ${err?.message || "Failed to delete ride"}`, "error");
      }
      setDeleting(false);
      setConfirmOpen(false);
    }, 300);
  };

  const handleUndo = async () => {
    if (!undoRow) return;
    try {
      await updateRide(COLLECTIONS.LIVE_RIDES, undoRow.id, undoRow);
      setUndoRow(null);
      showToast("✅ Ride restored", "success");
    } catch (err) {
      logError(err, "LiveRidesGrid:undo");
      showToast(`❌ ${err?.message || "Restore failed"}`, "error");
    }
  };

  return (
    <>
      <Box sx={{ width: "100%", overflowX: "auto" }}>
        <EditableRideGrid
          rows={rows || []}
          loading={loading}
          onDelete={(id) => {
            const row = rows.find((r) => r.id === id);
            setDeletingId(id);
            setDeletingTripId(row?.tripId || "");
            setConfirmOpen(true);
          }}
          refreshRides={refreshRides}
          onEdit={openEdit}
        />
      </Box>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete Ride?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete{" "}
            <strong>{safe(deletingTripId)}</strong>?
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

      {editing.open && (
        <EditRideDialog
          open={editing.open}
          ride={editing.row}
          collectionName={COLLECTIONS.LIVE_RIDES}
          onClose={closeEdit}
        />
      )}

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </>
  );
};

export default memo(LiveRidesGrid);
