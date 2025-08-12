/* Proprietary and confidential. See LICENSE. */
import React, { useState } from "react";
import { Box, Snackbar, Alert } from "@mui/material";
import { collection, query, orderBy } from "firebase/firestore";
import {
  deleteRideFromQueue,
  addRideToQueue,
  getRideQueue,
} from "../services/firestoreService";
import EditableRideGrid from "../components/EditableRideGrid";
import { logError } from "../utils/logError";
import { COLLECTIONS } from "../constants";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";
import { safe } from "../utils/rideFormatters";
import { useAuth } from "../context/AuthContext.jsx";
import { db } from "../utils/firebaseInit";
import useFirestoreSub from "../hooks/useFirestoreSub";

const RideQueueGrid = () => {
  const [rows, setRows] = useState([]);
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [loading, setLoading] = useState(true);
  const { user, authLoading } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingTripId, setDeletingTripId] = useState(null);
  const [undoRow, setUndoRow] = useState(null);

  useFirestoreSub(
    "rideQueue:all",
    () => {
      if (authLoading || !user?.email) return null;
      return query(collection(db, COLLECTIONS.RIDE_QUEUE), orderBy("pickupTime", "asc"));
    },
    (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    },
    () => {
      setToast({
        open: true,
        message: "Permissions issue loading ride queue",
        severity: "error",
      });
      setLoading(false);
    },
    [authLoading, user?.email]
  );

  const refreshRides = async () => {
    setLoading(true);
    const data = await getRideQueue();
    setRows(data);
    setLoading(false);
  };

  // ✅ Delete ride (Firestore)
  const confirmDeleteRide = async () => {
    if (!deletingId) return;
    const target = rows.find((r) => r.id === deletingId);
    setUndoRow(target);
    setRows((prev) =>
      prev.map((row) =>
        row.id === deletingId ? { ...row, fading: true } : row,
      ),
    );

    setTimeout(async () => {
      try {
        await deleteRideFromQueue(deletingId);
        setRows((prev) => prev.filter((row) => row.id !== deletingId));
        setToast({
          open: true,
          message: `🗑️ Deleted Trip ${safe(deletingTripId, "")}`,
          severity: "info",
        });
      } catch (err) {
        logError(err, "RideQueueGrid:delete");
        setToast({
          open: true,
          message: `❌ ${err?.message || JSON.stringify(err)}`,
          severity: "error",
        });
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
    try {
      await addRideToQueue(undoRow);
      setUndoRow(null);
      setToast({
        open: true,
        message: "✅ Ride restored",
        severity: "success",
      });
    } catch (err) {
      logError(err, "RideQueueGrid:undo");
      setToast({
        open: true,
        message: `❌ ${err?.message || JSON.stringify(err)}`,
        severity: "error",
      });
    }
  };

  return (
    <Box>
      <EditableRideGrid
        rows={rows}
        loading={loading}
        onDelete={(id) => {
          const row = rows.find((r) => r.id === id);
          setDeletingId(id);
          setDeletingTripId(row?.tripId || "");
          setConfirmOpen(true);
        }}
        refreshRides={refreshRides}
        sheetName={COLLECTIONS.RIDE_QUEUE}
      />

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete Ride?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete{" "}
            <strong>{safe(deletingTripId)}</strong> from the Ride Queue?
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

export default React.memo(RideQueueGrid);
