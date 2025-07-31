/* Proprietary and confidential. See LICENSE. */
// src/components/RideGroup.jsx
import React, { useState, useRef, useMemo } from 'react';
import {
  Box, Typography, Card, Button, Checkbox, Paper, Divider, Stack,
  useTheme, Grid, Snackbar, Alert, CircularProgress, useMediaQuery,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { calculateDropOff } from './timeUtils';

const RideDetailRow = ({ icon, label, preserveLine = false, highlightColor }) => {
  const [prefix, ...rest] = label.split(':');
  return (
    <Box display="flex" alignItems="flex-start" mb={0.5}>
      <Box sx={{ minWidth: '30px', pt: '2px' }}>{icon}</Box>
      <Typography sx={{ whiteSpace: preserveLine ? 'pre-line' : 'normal', color: highlightColor || 'inherit' }}>
        <strong>{prefix}:</strong>
        {rest.length > 0 ? rest.join(':') : ''}
      </Typography>
    </Box>
  );
};

function RideGroup({ groupKey, rides, onClaim, showToast }) {
  const [selectedInGroup, setSelectedInGroup] = useState([]);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [vehicle, , date] = groupKey.split('___');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const groupRef = useRef(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimingIds, setClaimingIds] = useState([]);
  const dayOfWeek = useMemo(() => window.dayjs(date).format('dddd'), [date]);
  const vehicleIcon = useMemo(() => {
    if (vehicle.startsWith('LRPSQD')) return '🚒';
    if (vehicle.startsWith('LRPSPR')) return '🚐';
    if (vehicle.startsWith('LRPSHU')) return '🚌';
    if (vehicle.startsWith('LRPBus')) return '🚌';
    return '🚗';
  }, [vehicle]);

  const handleToggle = (tripId) => {
    setSelectedInGroup((prev) =>
      prev.includes(tripId) ? prev.filter((id) => id !== tripId) : [...prev, tripId]
    );
  };

  const handleSelectAll = () => {
    const allIds = rides.map((r) => r.TripID);
    setSelectedInGroup((prev) => (prev.length === allIds.length ? [] : allIds));
  };

  const handleMultiClaim = async () => {
    setIsClaiming(true);
    setClaimingIds(selectedInGroup);
    try {
      const results = await Promise.allSettled(selectedInGroup.map((tripId) => onClaim(tripId)));
      const failures = results.filter((r) => r.status !== 'fulfilled');
      if (failures.length > 0) {
        showToast(`⚠️ ${failures.length} of ${selectedInGroup.length} rides failed to claim.`, 'warning');
      } else {
        showToast(`✅ Successfully claimed all ${selectedInGroup.length} rides!`, 'success');
      }
      setSelectedInGroup([]);
    } catch (error) {
      showToast('❌ One or more rides failed to claim.', 'error');
    } finally {
      setIsClaiming(false);
      setClaimingIds([]);
    }
  };

  const handleSingleClaim = async (tripId) => {
    setClaimingIds((prev) => [...prev, tripId]);
    try {
      await onClaim(tripId);
      setSelectedInGroup((prev) => prev.filter((id) => id !== tripId));
      showToast(`✅ Ride ${tripId} claimed!`, 'success');
      groupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      showToast('❌ Failed to claim ride.', 'error');
    } finally {
      setClaimingIds((prev) => prev.filter((id) => id !== tripId));
    }
  };

  if (!rides.length) {
    return (
      <Paper variant="outlined" sx={{ p: 3, mb: 3, textAlign: 'center' }}>
        <Typography variant="subtitle1" color="text.secondary">
          📭 No rides available in this group.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" ref={groupRef} sx={{ p: 2, mb: 4, borderLeft: '6px solid #4cbb17', backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fefefe' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} flexWrap="wrap" gap={1}>
        <Typography variant="h6" fontWeight="bold">
          {vehicleIcon} {vehicle} – 📅 {dayOfWeek} ({date})
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Total: {rides.length} rides
        </Typography>
        <Button variant="outlined" size="small" color="primary" onClick={handleSelectAll} aria-label="Select all rides in group" disabled={isClaiming}>
          {selectedInGroup.length === rides.length ? 'Deselect All' : 'Select All'}
        </Button>
      </Box>

      <Divider sx={{ mb: 2, borderColor: theme.palette.mode === 'dark' ? '#4cbb17' : '#81c784', opacity: 0.75, borderBottomWidth: '2px' }} />

      <Stack spacing={2}>
        {rides.map((ride) => {
          const isSelected = selectedInGroup.includes(ride.TripID);
          const isLoading = claimingIds.includes(ride.TripID);
          const dropoffTime = calculateDropOff(ride.PickupTime, ride.RideDuration);

          return (
            <Card key={ride.TripID} variant="outlined" sx={{
              p: 2,
              backgroundColor: isSelected
                ? theme.palette.mode === 'dark' ? '#324d28' : '#e8f5e9'
                : theme.palette.mode === 'dark' ? '#2a2a2a' : '#ffffff',
              border: isSelected ? '2px solid #4cbb17' : '1px solid',
              borderColor: isSelected ? '#4cbb17' : theme.palette.divider,
              transition: 'background 0.3s ease',
              '&:hover': {
                background: theme.palette.mode === 'dark'
                  ? 'linear-gradient(145deg, #355d2e, #2e4727)'
                  : 'linear-gradient(145deg, #e2fbe8, #d0f0d6)',
              },
            }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <RideDetailRow icon="🆔" label={`ID: ${ride.TripID}`} />
                  <Box display="flex" alignItems="baseline" gap={1} mb={1}>
                    <AccessTimeIcon fontSize="small" sx={{ mt: '2px', color: theme.palette.text.secondary }} />
                    <Typography variant="body2" color="text.primary">
                      Time: {ride.PickupTime} → {dropoffTime}
                    </Typography>
                    <Box sx={{
                      display: 'inline-flex', alignItems: 'baseline', px: 1.25, py: 0.25,
                      borderRadius: '20px', backgroundColor: theme.palette.mode === 'dark' ? '#19391d' : '#e6f4ea',
                      color: theme.palette.mode === 'dark' ? '#60e421' : '#2e7d32',
                      fontWeight: 700, fontSize: '0.75rem',
                      border: '1px solid', borderColor: theme.palette.mode === 'dark' ? '#4cbb17' : '#a5d6a7',
                      boxShadow: theme.palette.mode === 'dark' ? '0 0 4px rgba(76, 187, 23, 0.4)' : 'inset 0 0 0 1px #c8e6c9',
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                    }}>
                      {ride.RideDuration}
                    </Box>
                  </Box>

                  <RideDetailRow icon="🔁" label={`Type: ${ride.RideType}`} highlightColor={ride.RideType === 'Hourly' ? '#4cbb17' : undefined} />
                  {ride.RideNotes && (
                    <RideDetailRow icon="📝" label={`Notes: ${ride.RideNotes}`} preserveLine />
                  )}
                </Grid>

                <Grid item xs={12}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent={isMobile ? 'flex-start' : 'flex-end'} flexWrap="wrap">
                    <Box onClick={() => handleToggle(ride.TripID)} sx={{
                      cursor: 'pointer', px: 1, py: 0.25, borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                      border: '1px solid', borderColor: isSelected ? '#4cbb17' : theme.palette.divider,
                      backgroundColor: isSelected ? '#4cbb17' : theme.palette.mode === 'dark' ? '#2a2a2a' : '#f0f0f0',
                      color: isSelected ? '#fff' : theme.palette.text.primary, textAlign: 'center', transition: 'all 0.2s ease',
                      '&:hover': { backgroundColor: isSelected ? '#60e421' : '#ddd' },
                    }}>
                      {isSelected ? '✅ Selected' : 'Select'}
                    </Box>

                    <Button variant="contained" color="success" size="small" sx={{
                      fontWeight: 'bold', borderRadius: 2,
                      boxShadow: theme.palette.mode === 'dark' ? '0 0 3px #60e421' : '0 0 2px #a5d6a7',
                      '&:hover': {
                        boxShadow: theme.palette.mode === 'dark'
                          ? '0 0 5px rgba(96, 228, 33, 0.8)'
                          : '0 0 4px rgba(76, 187, 23, 0.4)',
                      },
                    }} onClick={() => handleSingleClaim(ride.TripID)} disabled={isClaiming || isLoading}>
                      {isLoading ? '⏳ Claiming...' : '✅ Claim'}
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </Card>
          );
        })}
      </Stack>

      {selectedInGroup.length > 0 && (
        <Box textAlign="center" mt={3}>
          <Button variant="contained" color="primary" onClick={handleMultiClaim} disabled={isClaiming}>
            🛒 CLAIM {selectedInGroup.length} SELECTED RIDES
          </Button>
        </Box>
      )}

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
}

export default React.memo(RideGroup);
