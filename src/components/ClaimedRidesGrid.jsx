/* Proprietary and confidential. See LICENSE. */
// src/components/ClaimedRidesGrid.jsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Snackbar,
  Alert,
  CircularProgress,
  IconButton,
  Stack,
  Paper,
  useMediaQuery,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { DataGrid } from "@mui/x-data-grid";
import {
  subscribeClaimedRides,
  deleteClaimedRide,
  restoreRide,
} from "../services/firestoreService";
import useToast from "../hooks/useToast";
import { logError } from "../utils/logError";
import { useAuth } from "../context/AuthContext.jsx";

const ClaimedRidesGrid = () => {
  const [rows, setRows] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [multiConfirmOpen, setMultiConfirmOpen] = useState(false);
  const [confirmUndoOpen, setConfirmUndoOpen] = useState(false);
  const { toast, showToast, closeToast } = useToast("info");
  const [loading, setLoading] = useState(true);
  const { user, authLoading } = useAuth();
  const [undoBuffer, setUndoBuffer] = useState([]);
  const isSmall = useMediaQuery((t) => t.breakpoints.down('sm'));

  useEffect(() => {
    if (authLoading || !user?.email) return;
    const unsub = subscribeClaimedRides(
      (data) => {
        setRows(data.map((r) => ({ ...r, fading: false })));
        setLoading(false);
      },
      undefined,
      () => {
        showToast("Permissions issue loading claimed rides", "error");
        setLoading(false);
      },
    );
    return unsub;
  }, [authLoading, user?.email]);

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
      try {
        await deleteClaimedRide(selectedRow.id);
        showToast("🗑️ Ride deleted", "info");
      } catch (err) {
        showToast(`❌ ${err?.message || "Delete failed"}`, "error");
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
        logError(err, "ClaimedRidesGrid:bulkDelete");
        showToast(
          `❌ Bulk delete failed: ${err?.message || JSON.stringify(err)}`,
          "error",
        );
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

    await Promise.all(
      undoBuffer.map(async (ride) => {
        try {
          await restoreRide(ride);
        } catch (err) {
          failed.push(ride.TripID);
        }
      }),
    );

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
    { field: "PickupTime", headerName: "Pickup Time", flex: 1 },
    { field: "RideDuration", headerName: "Duration", flex: 1 },
    { field: "RideType", headerName: "Ride Type", flex: 1 },
    { field: "Vehicle", headerName: "Vehicle", flex: 1 },
    { field: "RideNotes", headerName: "Notes", flex: 1 },
    { field: "CreatedBy", headerName: "Created By", flex: 1 },
    { field: "LastModifiedBy", headerName: "Modified By", flex: 1 },
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
            color: "common.white",
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
              bgcolor: (t) => t.palette.background.paper,
              color: "#ff1744",
              "&:hover": { bgcolor: "#eee" },
            }}
          >
            Delete Selected
          </Button>
        </Box>
      )}

      {isSmall ? (
        <Stack spacing={2} sx={{ mb: 2 }}>
          {rows.map((r) => (
            <Paper
              key={r.id}
              variant="outlined"
              sx={{ p: 2 }}
              className={r.fading ? "fade-out" : ""}
            >
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="flex-start"
              >
                <Box>
                  <Typography variant="subtitle2">{r.TripID}</Typography>
                  <Typography variant="body2">Pickup: {r.PickupTime}</Typography>
                  <Typography variant="body2">Duration: {r.RideDuration}</Typography>
                  <Typography variant="body2">Type: {r.RideType}</Typography>
                  <Typography variant="body2">Vehicle: {r.Vehicle}</Typography>
                  {r.RideNotes && (
                    <Typography variant="body2">Notes: {r.RideNotes}</Typography>
                  )}
                  {r.ClaimedBy && (
                    <Typography variant="body2">
                      Claimed By: {r.ClaimedBy}
                    </Typography>
                  )}
                </Box>
                <IconButton
                  color="error"
                  size="small"
                  onClick={() => {
                    setSelectedRow(r);
                    setConfirmOpen(true);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            autoHeight
            checkboxSelection
            disableRowSelectionOnClick
            getRowClassName={(params) => (params.row.fading ? 'fade-out' : '')}
            onRowSelectionModelChange={(model) => {
              setSelectedRows(model);
            }}
            loading={loading}
            sx={{ bgcolor: 'background.paper' }}
            columnVisibilityModel={isSmall ? { RideNotes: false, CreatedBy: false, LastModifiedBy: false, ClaimedBy: false, ClaimedAt: false } : undefined}
          />
        </Box>
      )}

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

export default React.memo(ClaimedRidesGrid);
