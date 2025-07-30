import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Button, TextField, Typography, MenuItem, Paper, Grid, Snackbar,
  Alert, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Badge, Tooltip, useMediaQuery
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import LiveClaimGrid from './LiveClaimGrid';
import RideQueueGrid from './RideQueueGrid';
import ClaimedRidesGrid from './ClaimedRidesGrid';
import { formatDuration, toTimeString12Hr } from '../timeUtils';
import { auth } from '../firebase';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {fetchLiveRides, fetchRideQueue} from '../hooks/api'
dayjs.extend(utc);
dayjs.extend(timezone);

const defaultValues = {
  TripID: '', Date: '', PickupTime: '', DurationHours: '', DurationMinutes: '', RideType: '', Vehicle: '', RideNotes: ''
};
const tripIdPattern = /^[A-Z0-9]{4}-[A-Z0-9]{2}$/i;

export default function RideEntryForm() {
  const [formData, setFormData] = useState(defaultValues);
  const [csvBuilder, setCsvBuilder] = useState(defaultValues);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const [preview, setPreview] = useState(null);
  const [rideTab, setRideTab] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [claimedCount, setClaimedCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [syncTime, setSyncTime] = useState('');
  const [multiInput, setMultiInput] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dataTab, setDataTab] = useState(0);
  const isMobile = useMediaQuery('(max-width:600px)');
  const currentUser = auth.currentUser?.email || 'Unknown';

  const errorFields = useRef({});

  useEffect(() => {
    const rideDuration = formatDuration(formData.DurationHours, formData.DurationMinutes);
    const formattedDate = formData.Date ? dayjs(formData.Date).tz('America/Chicago').format('M/D/YYYY') : 'N/A';
    const formattedTime = toTimeString12Hr(formData.PickupTime);
    setPreview({ ...formData, PickupTime: formattedTime, Date: formattedDate, RideDuration: rideDuration });
  }, [formData]);

  useEffect(() => {
    const getLiveAndClaimed = async () => {
      try {
        const data = await fetchLiveRides();
        if (!Array.isArray(data)) return;
  
        const live = data.filter(r => !r.ClaimedBy && r.Status !== 'Queued');
        const claimed = data.filter(r =>
          (r.ClaimedBy && r.ClaimedBy.trim() !== '') ||
          r.Status?.toLowerCase() === 'claimed'
        );
  
        setLiveCount(live.length);
        setClaimedCount(claimed.length);
      } catch (err) {
        console.error('Error fetching rides:', err);
      }
    };
  
    const getQueue = async () => {
      try {
        const queueData = await fetchRideQueue();
        if (!Array.isArray(queueData)) return;
        setQueueCount(queueData.length);
      } catch (err) {
        console.error('Error fetching queue:', err);
      }
    };
  
    getLiveAndClaimed();
    getQueue();
    setSyncTime(dayjs().format('hh:mm A'));
  }, []);
  

  const validateSingle = (data) => {
    const required = ['TripID', 'Date', 'PickupTime', 'RideType', 'Vehicle'];
    const errors = {};
    for (const field of required) {
      if (!data[field]?.trim()) errors[field] = true;
    }
    if (!tripIdPattern.test(data.TripID)) errors.TripID = true;
    if (isNaN(+data.DurationMinutes) || +data.DurationMinutes < 0 || +data.DurationMinutes > 59) errors.DurationMinutes = true;
    if (isNaN(+data.DurationHours) || +data.DurationHours < 0) errors.DurationHours = true;
    if (new Date(data.Date) < new Date('2024-01-01')) errors.Date = true;
    errorFields.current = errors;
    return Object.keys(errors).length === 0;
  };

  const handleDropDailyRides = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('https://lakeridepros.xyz/claim-proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'a9eF12kQvB67xZsT30pL', type: 'dropDailyRides' }),
      });
      const result = await res.json();
      if (result.success) {
        setToast({ open: true, message: '✅ Live ride list updated!', severity: 'success' });
        setSyncTime(dayjs().format('hh:mm A'));
        setRefreshTrigger((prev) => prev + 1);
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      setToast({ open: true, message: `❌ ${err.message}`, severity: 'error' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleChange = (e, stateSetter = setFormData) => {
    const { name, value } = e.target;
    let updatedValue = value;
    if (name === 'TripID') {
      const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      updatedValue = cleaned.length > 4 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}` : cleaned;
    }
    stateSetter(prev => ({ ...prev, [name]: updatedValue }));
  };
  
  const handleSubmit = async () => {
    if (submitting || !validateSingle(formData)) {
      setToast({ open: true, message: '❌ Fix form errors before submitting.', severity: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const rideDuration = formatDuration(formData.DurationHours, formData.DurationMinutes);
      const formattedDate = dayjs(formData.Date).tz('America/Chicago').format('MM/DD/YYYY');
      const formattedTime = dayjs(`2000-01-01T${formData.PickupTime}`).tz('America/Chicago').format('h:mm A');
      const payload = {
        ...formData,
        Date: formattedDate,
        PickupTime: formattedTime,
        RideDuration: rideDuration,
        CreatedBy: currentUser,
        LastModifiedBy: currentUser
      };
      const res = await fetch('https://lakeridepros.xyz/claim-proxy.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'a9eF12kQvB67xZsT30pL', type: 'addRide', sheet: 'RideQueue', data: payload })
      });
      const result = await res.json();
      if (result.success) {
        setToast({ open: true, message: '✅ Ride added!', severity: 'success' });
        setFormData(defaultValues);
        setConfirmOpen(false);
      } else throw new Error(result.message);
    } catch (err) {
      setToast({ open: true, message: `❌ ${err.message}`, severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSingleChange = (e) => {
    const { name, value } = e.target;
    let updatedValue = value;
    if (name === 'TripID') {
      const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      updatedValue = cleaned.length > 4 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}` : cleaned;
    }
    setFormData(prev => ({ ...prev, [name]: updatedValue }));
  };

  const handleCsvBuilderChange = (e) => {
    const { name, value } = e.target;
    setCsvBuilder(prev => ({ ...prev, [name]: value }));
  };
  

  const handleCsvAppend = () => {
    if (!validateSingle(csvBuilder)) {
      setToast({ open: true, message: '❌ CSV builder incomplete or invalid', severity: 'error' });
      return;
    }
    const line = [
      csvBuilder.TripID,
      dayjs(csvBuilder.Date).format('YYYY-MM-DD'),
      csvBuilder.PickupTime,
      csvBuilder.DurationHours,
      csvBuilder.DurationMinutes,
      csvBuilder.RideType,
      csvBuilder.Vehicle,
      csvBuilder.RideNotes || ''
    ].join(', ');
    setMultiInput(prev => (prev ? prev + '\n' + line : line));
    setCsvBuilder(defaultValues);
  };

  const handleMultiSubmit = async () => {
    if (!multiInput.trim()) {
      setToast({ open: true, message: '❌ No rides to submit', severity: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const lines = multiInput.trim().split('\n');
      for (const line of lines) {
        const [TripID, Date, PickupTime, DurationHours, DurationMinutes, RideType, Vehicle, RideNotes] =
          line.split(',').map(s => s.trim());
        const rideDuration = formatDuration(DurationHours, DurationMinutes);
        const payload = {
          TripID,
          Date: dayjs(Date).format('MM/DD/YYYY'),
          PickupTime: dayjs(`2000-01-01T${PickupTime}`).tz('America/Chicago').format('h:mm A'),
          RideDuration: rideDuration,
          RideType,
          Vehicle,
          RideNotes,
          CreatedBy: currentUser,
          LastModifiedBy: currentUser
        };
        await fetch('https://lakeridepros.xyz/claim-proxy.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: 'a9eF12kQvB67xZsT30pL',
            type: 'addRide',
            sheet: 'RideQueue',
            data: payload
          })
        });
      }
      setToast({ open: true, message: '✅ Rides added!', severity: 'success' });
      setMultiInput('');
    } catch (err) {
      setToast({ open: true, message: `❌ ${err.message}`, severity: 'error' });
    } finally {
      setSubmitting(false); // 🔥 critical
    }
  };
 

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 2 }}>
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>🚌 Ride Entry</Typography>
        <Tabs value={rideTab} onChange={(e, val) => setRideTab(val)} sx={{ mb: 2 }}>
          <Tab label="SINGLE RIDE" />
          <Tab label="MULTI RIDE UPLOAD" />
        </Tabs>

        {rideTab === 0 && (
  <Box sx={{ px: isMobile ? 1 : 3, py: 2 }}>
    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
      📝 Single Ride Details
    </Typography>

    <Grid container rowSpacing={0.75} columnSpacing={1}>
      {[
        { name: 'TripID', label: 'Trip ID', sm: 6 },
        { name: 'Date', label: 'Date', type: 'date', sm: 6, shrink: true },
        { name: 'PickupTime', label: 'Pickup Time', type: 'time', sm: 6, shrink: true },
        { name: 'DurationHours', label: 'Duration Hours', type: 'number', sm: 3 },
        { name: 'DurationMinutes', label: 'Duration Minutes', type: 'number', sm: 3 },
        { name: 'RideType', label: 'Ride Type', type: 'select', sm: 6 },
        { name: 'Vehicle', label: 'Vehicle', type: 'select', sm: 6 },
      ].map(({ name, label, type = 'text', sm, shrink }) => (
        <Grid item xs={12} sm={sm} key={name}>
          <TextField
            name={name}
            label={label}
            type={type}
            select={type === 'select'}
            value={formData[name]}
            onChange={handleSingleChange}
            fullWidth
            margin="dense"
            size="small"
            error={!!errorFields.current[name]}
            helperText={errorFields.current[name] && 'Required or Invalid'}
            InputLabelProps={shrink ? { shrink: true } : undefined}
            sx={{
              '& .MuiInputBase-root': { py: 0.5 },
              '& .MuiInputLabel-root': { top: -5 }
            }}
          >
            {name === 'RideType' && ['P2P', 'Round-Trip', 'Hourly'].map(opt => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
            {name === 'Vehicle' && [
              'LRPBus - Limo Bus',
              'LRPSHU - Shuttle',
              'LRPSPR - Sprinter',
              'LRPSQD - Rescue Squad'
            ].map(opt => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </TextField>
        </Grid>
      ))}

      <Grid item xs={12}>
        <TextField
          name="RideNotes"
          label="Ride Notes"
          value={formData.RideNotes}
          onChange={handleSingleChange}
          fullWidth
          multiline
          rows={2}
          margin="dense"
          size="small"
          sx={{
            '& .MuiInputBase-root': { py: 0.5 },
            '& .MuiInputLabel-root': { top: -5 }
          }}
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <Button
          fullWidth
          variant="contained"
          color="success"
          size="medium"
          sx={{ py: 1.1, fontWeight: 600 }}
          onClick={() => {
            if (!validateSingle(formData)) {
              setToast({ open: true, message: '❌ Fix form before submit', severity: 'error' });
            } else {
              setConfirmOpen(true);
            }
          }}
        >
          ✅ Review & Confirm
        </Button>
      </Grid>

      <Grid item xs={12} sm={6}>
        <Button
          fullWidth
          variant="outlined"
          color="warning"
          size="medium"
          sx={{ py: 1.1, fontWeight: 600 }}
          onClick={() => {
            setFormData(defaultValues);
            errorFields.current = {};
            setToast({ open: true, message: '♻️ Form reset.', severity: 'info' });
          }}
        >
          Reset
        </Button>
      </Grid>
    </Grid>
  </Box>
)}



{rideTab === 1 && (
  <Box sx={{ px: isMobile ? 1 : 3, py: 2 }}>
    <Grid container spacing={1}>
      {/* Raw CSV Input */}
      <Grid item xs={12}>
        <TextField
          label="Paste CSV Rides"
          fullWidth
          multiline
          rows={6}
          value={multiInput}
          onChange={(e) => setMultiInput(e.target.value)}
          margin="dense"
        />
      </Grid>

      {/* Divider Text */}
      <Grid item xs={12}>
        <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 2 }}>
          Or Use Ride Builder
        </Typography>
      </Grid>

      {/* Builder Inputs */}
      {[
        { name: 'TripID', label: 'Trip ID', sm: 6 },
        { name: 'Date', label: 'Date', type: 'date', sm: 6, shrink: true },
        { name: 'PickupTime', label: 'Pickup Time', type: 'time', sm: 6, shrink: true },
        { name: 'DurationHours', label: 'Duration Hours', type: 'number', sm: 3 },
        { name: 'DurationMinutes', label: 'Duration Minutes', type: 'number', sm: 3 },
        { name: 'RideType', label: 'Ride Type', type: 'select', sm: 6 },
        { name: 'Vehicle', label: 'Vehicle', type: 'select', sm: 6 },
      ].map(({ name, label, type = 'text', sm, shrink }) => (
        <Grid item xs={12} sm={sm} key={name}>
          <TextField
            name={name}
            label={label}
            type={type}
            select={type === 'select'}
            value={csvBuilder[name]}
            onChange={handleCsvBuilderChange}
            fullWidth
            margin="dense"
            size="small"
            InputLabelProps={shrink ? { shrink: true } : undefined}
            sx={{
              '& .MuiInputBase-root': { py: 0.5 },
              '& .MuiInputLabel-root': { top: -5 }
            }}
          >
            {name === 'RideType' && ['P2P', 'Round-Trip', 'Hourly'].map(opt => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
            {name === 'Vehicle' && [
              'LRPBus - Limo Bus',
              'LRPSHU - Shuttle',
              'LRPSPR - Sprinter',
              'LRPSQD - Rescue Squad'
            ].map(opt => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </TextField>
        </Grid>
      ))}

      {/* Notes Field */}
      <Grid item xs={12}>
        <TextField
          name="RideNotes"
          label="Ride Notes"
          value={csvBuilder.RideNotes}
          onChange={handleCsvBuilderChange}
          fullWidth
          multiline
          rows={2}
          margin="dense"
          size="small"
          sx={{
            '& .MuiInputBase-root': { py: 0.5 },
            '& .MuiInputLabel-root': { top: -5 }
          }}
        />
      </Grid>

      {/* Action Buttons */}
      <Grid item xs={12} sm={6}>
        <Button
          variant="outlined"
          fullWidth
          size="medium"
          onClick={handleCsvAppend}
          sx={{ py: 1.1, fontWeight: 600 }}
        >
          ➕ Add to List
        </Button>
      </Grid>
      <Grid item xs={12} sm={6}>
      <Button
  variant="contained"
  color="success"
  fullWidth
  size="medium"
  onClick={handleMultiSubmit}
  disabled={submitting}
  sx={{ py: 1.1, fontWeight: 600 }}
>
{submitting ? <CircularProgress size={20} color="inherit" /> : '🚀 Submit All Rides'}
</Button>
      </Grid>
    </Grid>
  </Box>
)}
</Paper>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            <SyncIcon fontSize="small" sx={{ mr: 1 }} />
            Synced: {syncTime}
          </Typography>
          <Button
            onClick={handleDropDailyRides}
            variant="outlined"
            color="secondary"
            startIcon={<SyncIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />}
          >
            🔁 Refresh
          </Button>
        </Box>
      </Paper>

      <Tabs value={dataTab} onChange={(e, val) => setDataTab(val)} centered sx={{ mb: 2 }}>
  <Tab
    label={
      <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
        <Typography fontWeight={600} color={dataTab === 0 ? 'success.main' : 'inherit'}>
          LIVE
        </Typography>
        <Badge
          badgeContent={liveCount}
          color="success"
          sx={{
            '& .MuiBadge-badge': {
              transform: 'scale(0.8) translate(100%, -20%)',
              transformOrigin: 'top right'
            }
          }}
        />
      </Box>
    }
  />
  <Tab
    label={
      <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
        <Typography fontWeight={600} color={dataTab === 1 ? 'success.main' : 'inherit'}>
          QUEUE
        </Typography>
        <Badge
          badgeContent={queueCount}
          color="primary"
          sx={{
            '& .MuiBadge-badge': {
              transform: 'scale(0.8) translate(100%, -20%)',
              transformOrigin: 'top right'
            }
          }}
        />
      </Box>
    }
  />
  <Tab
    label={
      <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
        <Typography fontWeight={600} color={dataTab === 2 ? 'success.main' : 'inherit'}>
          CLAIMED
        </Typography>
        <Badge
          badgeContent={claimedCount}
          color="secondary"
          sx={{
            '& .MuiBadge-badge': {
              transform: 'scale(0.8) translate(100%, -20%)',
              transformOrigin: 'top right'
            }
          }}
        />
      </Box>
    }
  />
</Tabs>


<Box sx={{ width: '100%', overflowX: 'hidden' }}>
        {dataTab === 0 && <LiveClaimGrid refreshTrigger={refreshTrigger} />}
        {dataTab === 1 && <RideQueueGrid refreshTrigger={refreshTrigger} />}
        {dataTab === 2 && <ClaimedRidesGrid refreshTrigger={refreshTrigger} />}
      </Box>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Ride</DialogTitle>
        <DialogContent dividers>
          {['TripID', 'Date', 'PickupTime', 'RideType', 'Vehicle', 'RideDuration', 'RideNotes'].map((key) => (
            <Typography key={key}><strong>{key.replace(/([A-Z])/g, ' $1')}:</strong> {preview?.[key] || '—'}</Typography>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="success">Submit</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity} variant="filled">{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
