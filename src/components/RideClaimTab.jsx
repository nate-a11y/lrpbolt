/* Proprietary and confidential. See LICENSE. */
// src/components/RideClaimTab.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box, Button, Typography, MenuItem, Select, FormControl, InputLabel,
  Snackbar, Alert, CircularProgress
} from '@mui/material';
import RideGroup from '../RideGroup';
import BlackoutOverlay from './BlackoutOverlay';
import { normalizeDate } from '../timeUtils';
import { fetchLiveRides, claimRide as apiClaimRide } from '../hooks/api';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { TIMEZONE } from '../constants';

dayjs.extend(utc);
dayjs.extend(timezone);
const CST = TIMEZONE;

const RideClaimTab = ({ driver, isAdmin = true, isLockedOut = false }) => {
  const [rides, setRides] = useState([]);
  const [groupedRides, setGroupedRides] = useState({});
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [claimLog, setClaimLog] = useState([]);
  const [loadingRides, setLoadingRides] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const hasLoadedRef = useRef(false);

  const showToast = (message, severity = 'success') =>
    setToast({ open: true, message, severity });

  const claimRide = async (tripId) => {
    const result = await apiClaimRide(tripId, driver);
    if (result.success) {
      setClaimLog((prev) => [...prev, { tripId, time: new Date().toLocaleTimeString() }]);
      hasLoadedRef.current = false;
      loadRides();
      return true;
    }
    throw new Error(result.message || 'Claim failed');
  };

  const loadRides = useCallback(async () => {
    setLoadingRides(true);
    try {
      const data = await fetchLiveRides();
      const unclaimed = data.filter((r) => {
        const claimed = (r.ClaimedBy || '').toString().trim().toLowerCase();
        return claimed === '' || claimed === 'unclaimed' || claimed === 'null' || claimed === 'none';
      });

      setRides(unclaimed);

      const grouped = {};
      unclaimed.forEach((r) => {
        const normalizedDate = normalizeDate(r.Date);
        const day = new Date(normalizedDate).toLocaleDateString('en-US', { weekday: 'long' });
        const key = `${r.Vehicle}___${day}___${normalizedDate}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(r);
      });
      setGroupedRides(grouped);
    } catch (err) {
      showToast('❌ Failed to load rides. Try again later.', 'error');
    } finally {
      setLoadingRides(false);
    }
  }, []);

  useEffect(() => {
    if (driver && !isLockedOut && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadRides();
    }
  }, [driver, isLockedOut, loadRides]);

  return (
    <Box position="relative">
      {isLockedOut && (
        <BlackoutOverlay
          isAdmin={isAdmin}
          isLocked={isLockedOut}
          onUnlock={() => {
            hasLoadedRef.current = false;
            loadRides();
          }}
        />
      )}

      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel>Day</InputLabel>
          <Select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)} label="Day">
            <MenuItem value="">All</MenuItem>
            {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d) => (
              <MenuItem key={d} value={d}>{d}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel>Vehicle</InputLabel>
          <Select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} label="Vehicle">
            <MenuItem value="">All</MenuItem>
            {Array.from(new Set(rides.map((r) => r.Vehicle))).map((v) => (
              <MenuItem key={v} value={v}>{v}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button variant="outlined" onClick={() => {
          hasLoadedRef.current = false;
          loadRides();
        }}>
          🔄 Refresh
        </Button>
      </Box>

      {loadingRides ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
          <Typography variant="body1" color="text.secondary" mr={2}>Loading rides...</Typography>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <>
          {Object.entries(groupedRides).map(([groupKey, rides]) => {
            const [vehicle, day] = groupKey.split('___');
            if ((vehicleFilter && vehicle !== vehicleFilter) || (dayFilter && day !== dayFilter)) return null;

            return (
              <RideGroup
                key={groupKey}
                groupKey={groupKey}
                rides={rides}
                onClaim={claimRide}
                showToast={showToast}
              />
            );
          })}

          {Object.keys(groupedRides).length === 0 && (
            <Typography variant="body1" color="text.secondary" textAlign="center" mt={5}>
              🚫 No unclaimed rides available right now.
            </Typography>
          )}
        </>
      )}

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity} variant="filled">
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RideClaimTab;