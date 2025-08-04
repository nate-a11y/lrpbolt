/* Proprietary and confidential. See LICENSE. */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Button, TextField, Typography, MenuItem, Paper, Grid, Snackbar,
  Alert, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Badge, Tooltip, useMediaQuery, Fade,
  InputAdornment
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LiveClaimGrid from './LiveClaimGrid';
import RideQueueGrid from './RideQueueGrid';
import ClaimedRidesGrid from './ClaimedRidesGrid';
import { formatDuration, toTimeString12Hr } from '../timeUtils';
import { auth } from '../firebase';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { TIMEZONE } from '../constants';
import { fetchLiveRides, fetchRideQueue, BASE_URL, SECURE_KEY } from '../hooks/api';
import { fetchWithRetry } from '../utils/network';
import Papa from 'papaparse';
import { LocalizationProvider, DatePicker, TimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DataGrid } from '@mui/x-data-grid';
import { useDropzone } from 'react-dropzone';
dayjs.extend(utc);
dayjs.extend(timezone);

const defaultValues = {
  TripID: '', Date: '', PickupTime: '', DurationHours: '', DurationMinutes: '', RideType: '', Vehicle: '', RideNotes: ''
};
const tripIdPattern = /^[A-Z0-9]{4}-[A-Z0-9]{2}$/i;

const rideTypeOptions = ['P2P', 'Round-Trip', 'Hourly'];
const vehicleOptions = [
  'LRPBus - Limo Bus',
  'LRPSHU - Shuttle',
  'LRPSPR - Sprinter',
  'LRPSQD - Rescue Squad'
];

const fieldConfig = [
  { name: 'TripID', label: 'Trip ID', sm: 6 },
  { name: 'Date', label: 'Date', type: 'date', sm: 6, shrink: true },
  { name: 'PickupTime', label: 'Pickup Time', type: 'time', sm: 6, shrink: true },
  { name: 'DurationHours', label: 'Duration Hours', type: 'number', sm: 3 },
  { name: 'DurationMinutes', label: 'Duration Minutes', type: 'number', sm: 3 },
  { name: 'RideType', label: 'Ride Type', type: 'select', sm: 6 },
  { name: 'Vehicle', label: 'Vehicle', type: 'select', sm: 6 }
];

const previewFields = [...fieldConfig.map(f => f.name), 'RideDuration', 'RideNotes'];

export default function RideEntryForm() {
  const [formData, setFormData] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rideForm')) || defaultValues;
    } catch {
      return defaultValues;
    }
  });
  const [csvBuilder, setCsvBuilder] = useState(defaultValues);
  const [uploadedRows, setUploadedRows] = useState([]);
  const [fileError, setFileError] = useState('');
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const preview = useMemo(() => {
    const rideDuration = formatDuration(formData.DurationHours, formData.DurationMinutes);
    const formattedDate = formData.Date ? dayjs(formData.Date).tz(TIMEZONE).format('M/D/YYYY') : 'N/A';
    const formattedTime = toTimeString12Hr(formData.PickupTime);
    return { ...formData, PickupTime: formattedTime, Date: formattedDate, RideDuration: rideDuration };
  }, [formData]);
  const [rideTab, setRideTab] = useState(() => Number(localStorage.getItem('rideTab') || 0));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [claimedCount, setClaimedCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [syncTime, setSyncTime] = useState('');
  const [multiInput, setMultiInput] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dataTab, setDataTab] = useState(() => Number(localStorage.getItem('dataTab') || 0));
  const isMobile = useMediaQuery('(max-width:600px)');
  const currentUser = auth.currentUser?.email || 'Unknown';
  const errorFields = useRef({});
  const [builderErrors, setBuilderErrors] = useState({});
  const onDrop = useCallback((accepted) => {
    setFileError('');
    const file = accepted[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xls', 'xlsx'].includes(ext)) {
      setFileError('Unsupported file type');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setUploadedRows(results.data);
        },
        error: (err) => setFileError(err.message)
      });
    };
    reader.readAsText(file);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  useEffect(() => {
    localStorage.setItem('rideForm', JSON.stringify(formData));
  }, [formData]);
  useEffect(() => {
    localStorage.setItem('rideTab', rideTab.toString());
  }, [rideTab]);
  useEffect(() => {
    localStorage.setItem('dataTab', dataTab.toString());
  }, [dataTab]);

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
  

  const validateFields = useCallback((data, setErrors) => {
    const required = ['TripID', 'Date', 'PickupTime', 'DurationHours', 'DurationMinutes', 'RideType', 'Vehicle'];
    const errors = {};
    for (const field of required) {
      if (!data[field]?.toString().trim()) errors[field] = true;
    }
    if (!tripIdPattern.test(data.TripID)) errors.TripID = true;
    if (isNaN(+data.DurationMinutes) || +data.DurationMinutes < 0 || +data.DurationMinutes > 59) errors.DurationMinutes = true;
    if (isNaN(+data.DurationHours) || +data.DurationHours < 0) errors.DurationHours = true;
    if (new Date(data.Date) < new Date('2024-01-01')) errors.Date = true;
    if (setErrors) setErrors(errors); else errorFields.current = errors;
    return Object.keys(errors).length === 0;
  }, []);

  const handleDropDailyRides = useCallback(async () => {
    setRefreshing(true);
    try {
        const res = await fetchWithRetry(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: SECURE_KEY, type: 'dropDailyRides' }),
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
  }, []);

  const handleChange = useCallback((e, stateSetter = setFormData, errorSetter) => {
    const { name, value } = e.target;
    let updatedValue = value;
    if (name === 'TripID') {
      const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      updatedValue = cleaned.length > 4 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}` : cleaned;
    }
    stateSetter(prev => {
      const next = { ...prev, [name]: updatedValue };
      validateFields(next, errorSetter);
      return next;
    });
  }, [validateFields]);
  
  const handleSubmit = useCallback(async () => {
    if (submitting || !validateFields(formData)) {
      setToast({ open: true, message: '❌ Fix form errors before submitting.', severity: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const rideDuration = formatDuration(formData.DurationHours, formData.DurationMinutes);
      const formattedDate = dayjs(formData.Date).tz(TIMEZONE).format('MM/DD/YYYY');
      const formattedTime = dayjs(`2000-01-01T${formData.PickupTime}`).tz(TIMEZONE).format('h:mm A');
      const payload = {
        ...formData,
        Date: formattedDate,
        PickupTime: formattedTime,
        RideDuration: rideDuration,
        CreatedBy: currentUser,
        LastModifiedBy: currentUser
      };
        const res = await fetchWithRetry(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: SECURE_KEY, type: 'addRide', sheet: 'RideQueue', data: payload })
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
  }, [formData, submitting, currentUser, validateFields]);

  const handleSingleChange = (e) => handleChange(e, setFormData);
  const handleCsvBuilderChange = (e) => handleChange(e, setCsvBuilder, setBuilderErrors);


  const handleCsvAppend = useCallback(() => {
    if (!validateFields(csvBuilder, setBuilderErrors)) {
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
    }, [csvBuilder, validateFields]);

  const handleMultiSubmit = useCallback(async () => {
    if (!multiInput.trim()) {
      setToast({ open: true, message: '❌ No rides to submit', severity: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const lines = multiInput.trim().split('\n');
      await Promise.all(lines.map(line => {
        const [TripID, Date, PickupTime, DurationHours, DurationMinutes, RideType, Vehicle, RideNotes] =
          line.split(',').map(s => s.trim());
        const rideDuration = formatDuration(DurationHours, DurationMinutes);
        const payload = {
          TripID,
          Date: dayjs(Date).format('MM/DD/YYYY'),
          PickupTime: dayjs(`2000-01-01T${PickupTime}`).tz(TIMEZONE).format('h:mm A'),
          RideDuration: rideDuration,
          RideType,
          Vehicle,
          RideNotes,
          CreatedBy: currentUser,
          LastModifiedBy: currentUser
        };
        return fetchWithRetry(BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: SECURE_KEY,
            type: 'addRide',
            sheet: 'RideQueue',
            data: payload
          })
        });
      }));
      setToast({ open: true, message: '✅ Rides added!', severity: 'success' });
      setMultiInput('');
    } catch (err) {
      setToast({ open: true, message: `❌ ${err.message}`, severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  }, [multiInput, currentUser]);

  const handleImportConfirm = useCallback(async () => {
    if (!uploadedRows.length) return;
    setSubmitting(true);
    try {
      await Promise.all(uploadedRows.map(row => {
        const rideDuration = formatDuration(row.DurationHours, row.DurationMinutes);
        const payload = {
          TripID: row.TripID,
          Date: dayjs(row.Date).format('MM/DD/YYYY'),
          PickupTime: dayjs(`2000-01-01T${row.PickupTime}`).tz(TIMEZONE).format('h:mm A'),
          RideDuration: rideDuration,
          RideType: row.RideType,
          Vehicle: row.Vehicle,
          RideNotes: row.RideNotes || '',
          CreatedBy: currentUser,
          LastModifiedBy: currentUser
        };
        return fetchWithRetry(BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: SECURE_KEY, type: 'addRide', sheet: 'RideQueue', data: payload })
        });
      }));
      setToast({ open: true, message: '✅ Rides added!', severity: 'success' });
      setUploadedRows([]);
    } catch (err) {
      setToast({ open: true, message: `❌ ${err.message}`, severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  }, [uploadedRows, currentUser]);
 

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 2 }}>
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Typography variant="h6" fontWeight={600}>🚐 Ride Entry</Typography>
        </Box>
        <Tabs value={rideTab} onChange={(e, val) => setRideTab(val)}
          sx={{ mb: 2 }} TabIndicatorProps={{ style: { backgroundColor: '#00c853' } }}>
          <Tab label="SINGLE RIDE" />
          <Tab label="MULTI RIDE UPLOAD" />
        </Tabs>

        {rideTab === 0 && (
  <Fade in>
    <Box sx={{ px: isMobile ? 1 : 3, py: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <TextField
            name="TripID"
            label="Trip ID"
            placeholder="Enter Trip ID"
            value={formData.TripID}
            onChange={handleSingleChange}
            fullWidth
            required
            error={!!errorFields.current.TripID}
            helperText={errorFields.current.TripID ? 'Required or invalid' : ' '}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <DatePicker
            label="Date"
            value={formData.Date ? dayjs(formData.Date) : null}
            onChange={(newVal) => handleSingleChange({ target: { name: 'Date', value: newVal ? newVal.format('YYYY-MM-DD') : '' } })}
            slots={{ openPickerIcon: CalendarMonthIcon }}
            slotProps={{ textField: { fullWidth: true, required: true, error: !!errorFields.current.Date, helperText: errorFields.current.Date ? 'Required or invalid' : ' ' } }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TimePicker
            label="Pickup Time"
            value={formData.PickupTime ? dayjs(`2000-01-01T${formData.PickupTime}`) : null}
            onChange={(newVal) => handleSingleChange({ target: { name: 'PickupTime', value: newVal ? newVal.format('HH:mm') : '' } })}
            slots={{ openPickerIcon: AccessTimeIcon }}
            slotProps={{ textField: { fullWidth: true, required: true, error: !!errorFields.current.PickupTime, helperText: errorFields.current.PickupTime ? 'Required or invalid' : ' ' } }}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            name="DurationHours"
            label="Duration Hours"
            type="number"
            value={formData.DurationHours}
            onChange={handleSingleChange}
            InputProps={{ endAdornment: <InputAdornment position="end">h</InputAdornment> }}
            required
            fullWidth
            error={!!errorFields.current.DurationHours}
            helperText={errorFields.current.DurationHours ? 'Invalid' : ' '}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            name="DurationMinutes"
            label="Duration Minutes"
            type="number"
            value={formData.DurationMinutes}
            onChange={handleSingleChange}
            InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }}
            required
            fullWidth
            error={!!errorFields.current.DurationMinutes}
            helperText={errorFields.current.DurationMinutes ? 'Invalid' : ' '}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            select
            name="RideType"
            label="Ride Type"
            value={formData.RideType}
            onChange={handleSingleChange}
            fullWidth
            required
            sx={{ minWidth: 200 }}
            error={!!errorFields.current.RideType}
            helperText={errorFields.current.RideType ? 'Required' : ' '}
          >
            {rideTypeOptions.map((opt) => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            select
            name="Vehicle"
            label="Vehicle"
            value={formData.Vehicle}
            onChange={handleSingleChange}
            fullWidth
            required
            sx={{ minWidth: 200 }}
            error={!!errorFields.current.Vehicle}
            helperText={errorFields.current.Vehicle ? 'Required' : ' '}
          >
            {vehicleOptions.map((opt) => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12}>
          <TextField
            name="RideNotes"
            label="Ride Notes"
            value={formData.RideNotes}
            onChange={handleSingleChange}
            fullWidth
            multiline
            rows={2}
          />
        </Grid>
        <Grid item xs={12}>
          <Box display="flex" justifyContent="flex-end" gap={2}>
            <Button
              variant="contained"
              color="success"
              startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
              disabled={!validateFields(formData) || submitting}
              onClick={() => setConfirmOpen(true)}
            >
              Review & Confirm
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => {
                setFormData(defaultValues);
                errorFields.current = {};
              }}
            >
              Reset
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  </Fade>
)}



{rideTab === 1 && (
  <Fade in>
    <Box sx={{ px: isMobile ? 1 : 3, py: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Button
            href="/ride-template.csv"
            variant="outlined"
            startIcon={<DownloadIcon />}
            download
            fullWidth
          >
            Download Template
          </Button>
        </Grid>
        <Grid item xs={12}>
          <Box
            {...getRootProps()}
            sx={{
              border: '2px dashed',
              borderColor: isDragActive ? 'success.main' : 'grey.500',
              p: 4,
              textAlign: 'center',
              bgcolor: 'background.default'
            }}
          >
            <input {...getInputProps()} />
            <UploadFileIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
            <Typography>
              {isDragActive ? 'Drop file here' : 'Drag & drop CSV/XLS here or click to select'}
            </Typography>
          </Box>
          {fileError && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {fileError}
            </Typography>
          )}
        </Grid>
        {uploadedRows.length > 0 && (
          <Grid item xs={12}>
            <Box sx={{ mt: 2 }}>
              <DataGrid
                autoHeight
                rows={uploadedRows.map((r, i) => ({ id: i, ...r }))}
                columns={[
                  { field: 'TripID', headerName: 'Trip ID', flex: 1 },
                  { field: 'Date', headerName: 'Date', flex: 1 },
                  { field: 'PickupTime', headerName: 'Pickup Time', flex: 1 },
                  { field: 'DurationHours', headerName: 'Dur H', flex: 1 },
                  { field: 'DurationMinutes', headerName: 'Dur M', flex: 1 },
                  { field: 'RideType', headerName: 'Ride Type', flex: 1 },
                  { field: 'Vehicle', headerName: 'Vehicle', flex: 1 }
                ]}
                pageSizeOptions={[5]}
              />
              <Button
                variant="contained"
                color="success"
                onClick={handleImportConfirm}
                disabled={submitting}
                sx={{ mt: 2 }}
                startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <UploadFileIcon />}
              >
                Import Rides
              </Button>
            </Box>
          </Grid>
        )}
        <Grid item xs={12}>
          <TextField
            label="Paste CSV Rides"
            fullWidth
            multiline
            rows={6}
            value={multiInput}
            onChange={(e) => setMultiInput(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            name="TripID"
            label="Trip ID"
            value={csvBuilder.TripID}
            onChange={handleCsvBuilderChange}
            required
            fullWidth
            error={!!builderErrors.TripID}
            helperText={builderErrors.TripID ? 'Required or invalid' : ' '}
            size="small"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <DatePicker
            label="Date"
            value={csvBuilder.Date ? dayjs(csvBuilder.Date) : null}
            onChange={(newVal) => handleCsvBuilderChange({ target: { name: 'Date', value: newVal ? newVal.format('YYYY-MM-DD') : '' } })}
            slots={{ openPickerIcon: CalendarMonthIcon }}
            slotProps={{ textField: { fullWidth: true, required: true, error: !!builderErrors.Date, helperText: builderErrors.Date ? 'Required or invalid' : ' ', size: 'small' } }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TimePicker
            label="Pickup Time"
            value={csvBuilder.PickupTime ? dayjs(`2000-01-01T${csvBuilder.PickupTime}`) : null}
            onChange={(newVal) => handleCsvBuilderChange({ target: { name: 'PickupTime', value: newVal ? newVal.format('HH:mm') : '' } })}
            slots={{ openPickerIcon: AccessTimeIcon }}
            slotProps={{ textField: { fullWidth: true, required: true, error: !!builderErrors.PickupTime, helperText: builderErrors.PickupTime ? 'Required or invalid' : ' ', size: 'small' } }}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            name="DurationHours"
            label="Duration Hours"
            type="number"
            value={csvBuilder.DurationHours}
            onChange={handleCsvBuilderChange}
            InputProps={{ endAdornment: <InputAdornment position="end">h</InputAdornment> }}
            required
            fullWidth
            size="small"
            error={!!builderErrors.DurationHours}
            helperText={builderErrors.DurationHours ? 'Invalid' : ' '}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            name="DurationMinutes"
            label="Duration Minutes"
            type="number"
            value={csvBuilder.DurationMinutes}
            onChange={handleCsvBuilderChange}
            InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }}
            required
            fullWidth
            size="small"
            error={!!builderErrors.DurationMinutes}
            helperText={builderErrors.DurationMinutes ? 'Invalid' : ' '}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            select
            name="RideType"
            label="Ride Type"
            value={csvBuilder.RideType}
            onChange={handleCsvBuilderChange}
            required
            fullWidth
            sx={{ minWidth: 200 }}
            size="small"
            error={!!builderErrors.RideType}
            helperText={builderErrors.RideType ? 'Required' : ' '}
          >
            {rideTypeOptions.map(opt => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            select
            name="Vehicle"
            label="Vehicle"
            value={csvBuilder.Vehicle}
            onChange={handleCsvBuilderChange}
            required
            fullWidth
            sx={{ minWidth: 200 }}
            size="small"
            error={!!builderErrors.Vehicle}
            helperText={builderErrors.Vehicle ? 'Required' : ' '}
          >
            {vehicleOptions.map(opt => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12}>
          <TextField
            name="RideNotes"
            label="Ride Notes"
            value={csvBuilder.RideNotes}
            onChange={handleCsvBuilderChange}
            fullWidth
            multiline
            rows={2}
            size="small"
          />
        </Grid>
        <Grid item xs={12}>
          <Box display="flex" justifyContent="flex-end" gap={2}>
            <Button
              variant="contained"
              onClick={handleCsvAppend}
              sx={{ fontWeight: 600 }}
            >
              ➕ Add to List
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleMultiSubmit}
              disabled={submitting}
              sx={{ fontWeight: 600 }}
            >
              {submitting ? <CircularProgress size={20} color="inherit" /> : '🚀 Submit All Rides'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  </Fade>
)}
</Paper>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            <SyncIcon fontSize="small" sx={{ mr: 1 }} />
            Synced: {syncTime}
          </Typography>
          <Tooltip title="Runs Apps Script to update daily rides (not for refreshing tables)">
            <span>
              <Button
                onClick={handleDropDailyRides}
                variant="outlined"
                color="secondary"
                startIcon={<SyncIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />}
              >
                Update Daily Rides
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Paper>

      <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
        <Tabs value={dataTab} onChange={(e, val) => setDataTab(val)}
          TabIndicatorProps={{ style: { backgroundColor: '#00c853' } }}
          sx={{ flexGrow: 1 }}>
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
      </Box>


      <Box sx={{ width: '100%', overflowX: 'hidden' }}>
        {dataTab === 0 && (
          <Fade in>
            <Box>
              <LiveClaimGrid refreshTrigger={refreshTrigger} />
            </Box>
          </Fade>
        )}
        {dataTab === 1 && (
          <Fade in>
            <Box>
              <RideQueueGrid refreshTrigger={refreshTrigger} />
            </Box>
          </Fade>
        )}
        {dataTab === 2 && (
          <Fade in>
            <Box>
              <ClaimedRidesGrid refreshTrigger={refreshTrigger} />
            </Box>
          </Fade>
        )}
      </Box>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Ride</DialogTitle>
        <DialogContent dividers>
          {previewFields.map((key) => (
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
    </LocalizationProvider>
  );
}
