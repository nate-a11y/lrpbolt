/* Proprietary and confidential. See LICENSE. */
// src/components/ClaimedRidesGrid.jsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, Snackbar, Alert, Tooltip, CircularProgress,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import { DataGrid } from '@mui/x-data-grid';
import { deleteRide, restoreRide, BASE_URL } from '../hooks/api';
import useToast from '../hooks/useToast';

const CLAIMED_RIDES_URL = `${BASE_URL}?type=claimedRides`;

const ClaimedRidesGrid = ({ refreshTrigger = 0 }) => {
  const [rows, setRows] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [multiConfirmOpen, setMultiConfirmOpen] = useState(false);
  const [confirmUndoOpen, setConfirmUndoOpen] = useState(false);
  const { toast, showToast, closeToast } = useToast('info');
  const [loading, setLoading] = useState(true);
  const [undoBuffer, setUndoBuffer] = useState([]);

  const fetchClaimedRides = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(CLAIMED_RIDES_URL);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Invalid data structure');
      const claimed = data.map((r) => ({
        TripID: r.TripID,
        ClaimedBy: r.ClaimedBy,
        ClaimedAt: r.ClaimedAt || 'N/A',
        fading: false,
      }));
      setRows(claimed);
    } catch (err) {
      console.error('Error loading claimed rides:', err);
      showToast('❌ Failed to load claimed rides', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchClaimedRides();
  }, [refreshTrigger, fetchClaimedRides]);

  const handleDelete = async () => {
    if (!selectedRow?.TripID) return;
    setLoading(true);
    setUndoBuffer([selectedRow]);
    setRows((prev) =>
      prev.map((row) =>
        row.TripID === selectedRow.TripID ? { ...row, fading: true } : row
      )
    );
    setTimeout(async () => {
      const res = await deleteRide(selectedRow.TripID, 'Sheet1');
      if (res.success) {
        showToast('🗑️ Ride deleted', 'info');
        fetchClaimedRides();
      } else {
        showToast(`❌ ${res.message}`, 'error');
      }
      setLoading(false);
      setConfirmOpen(false);
    }, 300);
  };

  const handleBulkDelete = async () => {
    setLoading(true);
    const toDelete = rows.filter((row) => selectedRows.includes(row.TripID));
    setUndoBuffer(toDelete);
    setRows((prev) =>
      prev.map((row) =>
        selectedRows.includes(row.TripID) ? { ...row, fading: true } : row
      )
    );
    setTimeout(async () => {
      try {
        await Promise.all(selectedRows.map(id => deleteRide(id, 'Sheet1')));
        showToast('✅ Selected rides deleted', 'info');
        setSelectedRows([]);
        fetchClaimedRides();
      } catch (err) {
        showToast(`❌ Bulk delete failed: ${err.message}`, 'error');
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
      undoBuffer.map(ride => restoreRide(ride))
    );
    results.forEach((res, idx) => {
      if (!res.success) failed.push(undoBuffer[idx].TripID);
    });

    if (failed.length) {
      showToast(`⚠️ Failed to restore: ${failed.join(', ')}`, 'warning');
    } else {
      showToast('✅ Undo successful', 'success');
      fetchClaimedRides();
    }

    setUndoBuffer([]);
    setLoading(false);
  };

  const columns = [
    { field: 'TripID', headerName: 'Trip ID', flex: 1 },
    { field: 'ClaimedBy', headerName: 'Claimed By', flex: 1 },
    { field: 'ClaimedAt', headerName: 'Claimed At', flex: 1 },
    {
      field: 'actions',
      headerName: '',
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
        <Box display="flex" justifyContent="space-between" alignItems="center"
          sx={{ bgcolor: '#ff1744', color: '#fff', px: 2, py: 1, mb: 2, borderRadius: 1, boxShadow: 3 }}>
          <Typography>{selectedRows.length} selected</Typography>
          <Button onClick={() => setMultiConfirmOpen(true)} variant="contained" color="inherit"
            startIcon={<DeleteIcon />} sx={{ bgcolor: '#fff', color: '#ff1744', '&:hover': { bgcolor: '#eee' } }}>
            Delete Selected
          </Button>
        </Box>
      )}

      <Box display="flex" justifyContent="flex-end" mb={1}>
        <Tooltip title="Refresh Claimed Rides">
          <span>
            <IconButton onClick={fetchClaimedRides} disabled={loading}>
              <RefreshIcon sx={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <DataGrid
        getRowId={(row) => row.TripID}
        rows={rows}
        columns={columns}
        autoHeight
        checkboxSelection
        disableRowSelectionOnClick
        getRowClassName={(params) => (params.row.fading ? 'fade-out' : '')}
        onRowSelectionModelChange={(model) => {
          const selected = Array.from(model.ids);
          setSelectedRows(selected);
        }}
        loading={loading}
        sx={{ bgcolor: 'background.paper' }}
      />

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete Ride?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{selectedRow?.TripID}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" color="error" disabled={loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}>
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={multiConfirmOpen} onClose={() => setMultiConfirmOpen(false)}>
        <DialogTitle>Delete Selected Rides</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{selectedRows.length}</strong> rides?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMultiConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkDelete} variant="contained" color="error" disabled={loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}>
            {loading ? 'Deleting...' : 'Delete All'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmUndoOpen} onClose={() => setConfirmUndoOpen(false)}>
        <DialogTitle>Restore Deleted Rides?</DialogTitle>
        <DialogContent>
          <Typography>
            This will restore {undoBuffer.length} ride{undoBuffer.length === 1 ? '' : 's'} back into the system. Are you sure?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmUndoOpen(false)}>Cancel</Button>
          <Button onClick={() => { handleUndo(); setConfirmUndoOpen(false); }} variant="contained" color="success">
            Yes, Undo
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={4000} onClose={closeToast}>
        <Alert severity={toast.severity} onClose={closeToast}
          action={toast.undoable && (
            <Button color="inherit" size="small" onClick={() => setConfirmUndoOpen(true)}>
              UNDO
            </Button>
          )}>
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
