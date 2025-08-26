/* Proprietary and confidential. See LICENSE. */
// src/components/ClaimedRidesGrid.jsx
import React, { useEffect, useState, useMemo } from "react";
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
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { DataGridPro, GridActionsCellItem } from "@mui/x-data-grid-pro";
import { subscribeRides, deleteRide } from "../services/firestoreService";
import { patchRide } from "../services/rides";
import { COLLECTIONS } from "../constants";
import useToast from "../hooks/useToast";
import { logError } from "../utils/logError";
import { useAuth } from "../context/AuthContext.jsx";
import EditRideDialog from "./EditRideDialog";
import { shapeRideRow } from "../services/shapeRideRow";
import useGridProDefaults from "./grid/useGridProDefaults.js";
import { fmtDuration } from "../utils/timeUtils";

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
  const [editing, setEditing] = useState({ open: false, row: null });
  const gridProps = useGridProDefaults({ gridId: "ClaimedRides" });


  function openEdit(row) {
    setEditing({ open: true, row });
  }

  function closeEdit(didSave) {
    setEditing({ open: false, row: null });
    // Claimed rides subscribe to snapshot; no refresh needed
  }

  useEffect(() => {
    if (authLoading || !user?.email) return;
    const unsub = subscribeRides(
      COLLECTIONS.CLAIMED_RIDES,
      (data) => {
        const rows = data.map((r) => ({
          ...shapeRideRow({ id: r.id, data: () => r }),
          fading: false,
        }));
        setRows(rows);
        setLoading(false);
      },
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
        await deleteRide(COLLECTIONS.CLAIMED_RIDES, selectedRow.id);
        showToast("🗑️ Ride deleted", "info");
      } catch (err) {
        logError(err, "ClaimedRidesGrid:delete");
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
        await Promise.all(
          selectedRows.map((id) => deleteRide(COLLECTIONS.CLAIMED_RIDES, id)),
        );
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
          await patchRide(
            COLLECTIONS.RIDE_QUEUE,
            ride.id,
            ride,
            user?.email || "Unknown",
          );
        } catch (err) {
          logError(err, "ClaimedRidesGrid:undo");
          failed.push(ride.tripId);
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
    { field: "tripId", headerName: "Trip ID", flex: 1.1, minWidth: 140 },
    { field: "pickupDateStr", headerName: "Date", flex: 0.9, minWidth: 120 },
    {
      field: "pickupTimeStr",
      headerName: "Pickup Time",
      flex: 0.9,
      minWidth: 130,
    },
      {
        field: "rideDuration",
        headerName: "Duration",
        flex: 0.7,
        minWidth: 110,
        valueGetter: ({ row }) => ({
          s: row.pickupTime,
          e:
            row.pickupTime && row.rideDuration
              ? row.pickupTime + row.rideDuration * 60000
              : null,
        }),
        valueFormatter: ({ value }) => fmtDuration(value?.s, value?.e),
        sortComparator: (a, b) => {
          const da = (a?.e ?? 0) - (a?.s ?? 0);
          const db = (b?.e ?? 0) - (b?.s ?? 0);
          return da - db;
        },
      },
    { field: "rideType", headerName: "Ride Type", flex: 1, minWidth: 140 },
    { field: "vehicle", headerName: "Vehicle", flex: 1, minWidth: 160 },
    {
      field: "rideNotes",
      headerName: "Notes",
      flex: 1.2,
      minWidth: 180,
      valueFormatter: (p) => (p?.value ? String(p.value) : "N/A"),
    },
    { field: "createdBy", headerName: "Created By", flex: 1, minWidth: 160 },
    {
      field: "lastModifiedBy",
      headerName: "Modified By",
      flex: 1,
      minWidth: 160,
    },
    { field: "claimedBy", headerName: "Claimed By", flex: 1, minWidth: 160 },
    {
      field: "actions",
      type: "actions",
      width: 80,
      getActions: (params) => [
        <GridActionsCellItem
          key="edit"
          icon={<EditIcon />}
          label="Edit"
          onClick={() => openEdit(params.row)}
        />,
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon />}
          label="Delete"
          onClick={() => {
            setSelectedRow(params.row);
            setConfirmOpen(true);
          }}
        />,
      ],
    },
  ];

  const summaryRow = useMemo(() => {
    const total = rows.reduce(
      (sum, r) => sum + (Number.isFinite(r.rideDuration) ? r.rideDuration : 0),
      0,
    );
    return { id: "summary", tripId: "Totals", rideDuration: total };
  }, [rows]);

  const initialState = useMemo(
    () => ({
      ...gridProps.initialState,
      columns: {
        ...gridProps.initialState.columns,
        columnVisibilityModel: {
          rideNotes: false,
          createdBy: false,
          lastModifiedBy: false,
          ...gridProps.initialState.columns.columnVisibilityModel,
        },
      },
    }),
    [gridProps.initialState],
  );

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

      <DataGridPro
        rows={rows || []}
        columns={columns}
        checkboxSelection
        getRowClassName={(params = {}) =>
          params?.row?.fading ? "fade-out" : ""
        }
        onRowSelectionModelChange={(model) => {
          setSelectedRows(model);
        }}
        loading={loading}
        pinnedRows={{ bottom: [summaryRow] }}
        {...gridProps}
        initialState={initialState}
        sx={{ ...gridProps.sx, bgcolor: "background.paper" }}
      />

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete Ride?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete{" "}
            <strong>{selectedRow?.tripId}</strong>?
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

      {editing.open && (
        <EditRideDialog
          open={editing.open}
          ride={editing.row}
          collectionName={COLLECTIONS.CLAIMED_RIDES}
          onClose={closeEdit}
        />
      )}

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
