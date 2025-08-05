/* Proprietary and confidential. See LICENSE. */
// src/components/ClaimedRidesGrid.jsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Snackbar,
  Alert,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import { DataGrid } from "@mui/x-data-grid";
import { deleteClaimedRide, restoreRide } from "../hooks/api";
import useClaimedRides from "../hooks/useClaimedRides";
import useToast from "../hooks/useToast";

const ClaimedRidesGrid = () => {
  const [rows, setRows] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [multiConfirmOpen, setMultiConfirmOpen] = useState(false);
  const [confirmUndoOpen, setConfirmUndoOpen] = useState(false);
  const { toast, showToast, closeToast } = useToast("info");
  const [loading, setLoading] = useState(true);
  const [undoBuffer, setUndoBuffer] = useState([]);

  const claimedRides = useClaimedRides();

  // ✅ Update rows from shared hook
  useEffect(() => {
    const claimed = claimedRides.map((r) => ({
      id: r.id,
      TripID: r.tripId || r.TripID,
      ClaimedBy: r.claimedBy || r.ClaimedBy,
      ClaimedAt: r.claimedAt
        ? r.claimedAt.toDate().toLocaleString()
        : r.ClaimedAt || "N/A",
      fading: false,
    }));
    setRows(claimed);
    setLoading(false);
  }, [claimedRides]);

  const handleDelete = async () => {
    if (!selectedRow?.id) return;
    setLoading(true);
    setUndoBuffer([selectedRow]);
    setRows((prev) =>
      prev.map((row) =>
        row.id === selectedRow.id ? { ...row, fading: true } : row,
      ),
    );
    setTimeout(async () => {
      const res = await deleteClaimedRide(selectedRow.id);
      if (res.success) {
        showToast("🗑️ Ride deleted", "info");
      } else {
        showToast(`❌ ${res.message}`, "error");
      }
      setLoading(false);
      setConfirmOpen(false);
    }, 300);
  };

  const handleBulkDelete = async () => {
    setLoading(true);
    const toDelete = rows.filter((row) => selectedRows.includes(row.id));
    setUndoBuffer(toDelete);
    setRows((prev) =>
      prev.map((row) =>
        selectedRows.includes(row.id) ? { ...row, fading: true } : row,
      ),
    );
    setTimeout(async () => {
      try {
        await Promise.all(selectedRows.map((id) => deleteClaimedRide(id)));
        showToast("✅ Selected rides deleted", "info");
        setSelectedRows([]);
      } catch (err) {
        showToast(`❌ Bulk delete failed: ${err.message}`, "error");
      } finally {
        setLoading(false);
        setMultiConfirmOpen(false);
      }
    }, 300);
  };

  const handleUndo = async () => {
    if (!undoBuffer.length) return;
    setLoading(true);
    const failed = [];

    const results = await Promise.all(
      undoBuffer.map((ride) => restoreRide(ride)),
    );
    results.forEach((res, idx) => {
      if (!res.success) failed.push(undoBuffer[idx].TripID);
    });

    if (failed.length) {
      showToast(`⚠️ Failed to restore: ${failed.join(", ")}`, "warning");
    } else {
      showToast("✅ Undo successful", "success");
    }

    setUndoBuffer([]);
    setLoading(false);
  };

  const columns = [
    { field: "TripID", headerName: "Trip ID", flex: 1 },
    { field: "ClaimedBy", headerName: "Claimed By", flex: 1 },
    { field: "ClaimedAt", headerName: "Claimed At", flex: 1 },
    {
      field: "actions",
      headerName: "",
      width: 80,
      sortable: false,
      renderCell: (params) => (
        <IconButton
          color="error"
          onClick={() => {
            setSelectedRow(params.row);
            setConfirmOpen(true);
          }}
        >
          <DeleteIcon />
        </IconButton>
      ),
    },
  ];

  return (
    <Box>
      {selectedRows.length > 0 && (
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          sx={{
            bgcolor: "#ff1744",
            color: "#fff",
            px: 2,
            py: 1,
            mb: 2,
            borderRadius: 1,
            boxShadow: 3,
          }}
        >
          <Typography>{selectedRows.length} selected</Typography>
          <Button
            onClick={() => setMultiConfirmOpen(true)}
            variant="contained"
            color="inherit"
            startIcon={<DeleteIcon />}
            sx={{
              bgcolor: "#fff",
              color: "#ff1744",
              "&:hover": { bgcolor: "#eee" },
            }}
          >
            Delete Selected
          </Button>
        </Box>
      )}

      <Box display="flex" justifyContent="flex-end" mb={1}>
        <Tooltip title="Real-time updates enabled">
          <span>
            <IconButton
              onClick={() =>
                showToast("🔥 Real-time updates active", "info")
              }
              disabled={loading}
            >
              <RefreshIcon
                sx={{ animation: loading ? "spin 1s linear infinite" : "none" }}
              />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <DataGrid
        rows={rows}
        columns={columns}
        autoHeight
        checkboxSelection
        disableRowSelectionOnClick
        getRowClassName={(params) => (params.row.fading ? "fade-out" : "")}
        onRowSelectionModelChange={(model) => {
          setSelectedRows(model);
        }}
        loading={loading}
        sx={{ bgcolor: "background.paper" }}
      />

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete Ride?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete{" "}
            <strong>{selectedRow?.TripID}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            disabled={loading}
            startIcon={
              loading ? <CircularProgress size={18} color="inherit" /> : null
            }
          >
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={multiConfirmOpen}
        onClose={() => setMultiConfirmOpen(false)}
      >
        <DialogTitle>Delete Selected Rides</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete{" "}
            <strong>{selectedRows.length}</strong> rides?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMultiConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={handleBulkDelete}
            variant="contained"
            color="error"
            disabled={loading}
            startIcon={
              loading ? <CircularProgress size={18} color="inherit" /> : null
            }
          >
            {loading ? "Deleting..." : "Delete All"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmUndoOpen} onClose={() => setConfirmUndoOpen(false)}>
        <DialogTitle>Restore Deleted Rides?</DialogTitle>
        <DialogContent>
          <Typography>
            This will restore {undoBuffer.length} ride
            {undoBuffer.length === 1 ? "" : "s"} back into the system. Are you
            sure?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmUndoOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              handleUndo();
              setConfirmUndoOpen(false);
            }}
            variant="contained"
            color="success"
          >
            Yes, Undo
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={4000} onClose={closeToast}>
        <Alert
          severity={toast.severity}
          onClose={closeToast}
          action={
            toast.undoable && (
              <Button
                color="inherit"
                size="small"
                onClick={() => setConfirmUndoOpen(true)}
              >
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
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; transform: scale(0.98); }
          }
          .fade-out {
            animation: fadeOut 0.4s ease-in-out forwards;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </Box>
  );
};

export default ClaimedRidesGrid;
