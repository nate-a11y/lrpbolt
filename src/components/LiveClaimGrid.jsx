/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, IconButton, Snackbar, Alert, Tooltip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { fetchLiveRides, deleteRide } from '../hooks/api';
import EditableRideGrid from '../components/EditableRideGrid';
import { normalizeDate, normalizeTime } from '../timeUtils';
import {
  Dialog, Typography, DialogTitle, DialogContent, DialogActions, Button
} from '@mui/material';
import useToast from '../hooks/useToast';


const LiveClaimGrid = ({ refreshTrigger }) => {
  const [rows, setRows] = useState([]);
  const { toast, showToast, closeToast } = useToast('success');
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingTripID, setDeletingTripID] = useState('');
  const [deleting, setDeleting] = useState(false);
 


  const refreshRides = useCallback(() => {
    setLoading(true);
    fetchLiveRides()
      .then(data => {
        const mapped = data.map((row, i) => ({
          id: row.TripID,
          ...row,
          Date: normalizeDate(row.Date),
          PickupTime: normalizeTime(row.PickupTime),
          }));
        setRows(mapped);
      })
      .catch(err => {
        showToast(`❌ Failed to load rides: ${err.message}`, 'error');
      })
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    refreshRides();
  }, [refreshTrigger, refreshRides]);
  

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    const res = await deleteRide(deletingTripID, 'Sheet1');
    if (res.success) {
      setRows(prev => prev.filter(row => row.TripID !== deletingTripID));
      showToast(`🗑️ Deleted Trip ${deletingTripID}`, 'info');
    } else {
      showToast(`❌ ${res.message}`, 'error');
    }
    setDeleting(false);
    setConfirmOpen(false);
  };


  return (
    <Box>
      <Box display="flex" justifyContent="flex-end" alignItems="center" mb={1}>
        <Tooltip title="Refresh Ride List">
          <span>
          <IconButton onClick={refreshRides} disabled={loading} aria-label="Refresh rides">
            <RefreshIcon
              sx={{
                animation: loading ? 'spin 1s linear infinite' : 'none'
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
        refreshRides={refreshRides}
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
    <Button onClick={handleDeleteConfirmed} variant="contained" color="error" disabled={deleting}>
      {deleting ? 'Deleting...' : 'Delete'}
    </Button>
  </DialogActions>
</Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={closeToast}
      >
        <Alert onClose={closeToast} severity={toast.severity} variant="filled">
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
