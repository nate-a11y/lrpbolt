/* Proprietary and confidential. See LICENSE. */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Button, TextField, Typography, MenuItem, Paper, Grid, Snackbar,
  Alert, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Badge, Tooltip, useMediaQuery, Fade, InputAdornment
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

  const handleSingleChange = (e) => handleChange(e, setFormData);
  const handleCsvBuilderChange = (e) => handleChange(e, setCsvBuilder, setBuilderErrors);

  // (Keeping submit handlers the same as your version)
  // ...

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

          {/* SINGLE RIDE */}
          {rideTab === 0 && (
            <Fade in>
              <Box sx={{ px: isMobile ? 1 : 3, py: 2 }}>
                <Grid container spacing={2}>
                  {/* Row 1 */}
                  <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Trip ID" name="TripID" value={formData.TripID} onChange={handleSingleChange} error={!!errorFields.current.TripID} helperText={errorFields.current.TripID ? 'Required or invalid' : ' '} /></Grid>
                  <Grid item xs={12} sm={4}><DatePicker label="Date" value={formData.Date ? dayjs(formData.Date) : null} onChange={(val) => handleSingleChange({ target: { name: 'Date', value: val?.format('YYYY-MM-DD') || '' } })} slotProps={{ textField: { fullWidth: true, size: 'small', error: !!errorFields.current.Date, helperText: errorFields.current.Date ? 'Required or invalid' : ' ' } }} /></Grid>
                  <Grid item xs={12} sm={4}><TimePicker label="Pickup Time" value={formData.PickupTime ? dayjs(`2000-01-01T${formData.PickupTime}`) : null} onChange={(val) => handleSingleChange({ target: { name: 'PickupTime', value: val?.format('HH:mm') || '' } })} slotProps={{ textField: { fullWidth: true, size: 'small', error: !!errorFields.current.PickupTime, helperText: errorFields.current.PickupTime ? 'Required or invalid' : ' ' } }} /></Grid>

                  {/* Row 2 */}
                  <Grid item xs={6} sm="auto"><TextField sx={{ maxWidth: 90 }} fullWidth size="small" label="Hours" name="DurationHours" type="number" InputProps={{ endAdornment: <InputAdornment position="end">h</InputAdornment> }} value={formData.DurationHours} onChange={handleSingleChange} error={!!errorFields.current.DurationHours} helperText={errorFields.current.DurationHours ? 'Invalid' : ' '} /></Grid>
                  <Grid item xs={6} sm="auto"><TextField sx={{ maxWidth: 90 }} fullWidth size="small" label="Minutes" name="DurationMinutes" type="number" InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }} value={formData.DurationMinutes} onChange={handleSingleChange} error={!!errorFields.current.DurationMinutes} helperText={errorFields.current.DurationMinutes ? 'Invalid' : ' '} /></Grid>

                  {/* Row 3 */}
                  <Grid item xs={12} sm><TextField fullWidth select size="small" label="Ride Type" name="RideType" value={formData.RideType} onChange={handleSingleChange} error={!!errorFields.current.RideType} helperText={errorFields.current.RideType ? 'Required' : ' '}>{rideTypeOptions.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}</TextField></Grid>
                  <Grid item xs={12} sm><TextField fullWidth select size="small" label="Vehicle" name="Vehicle" value={formData.Vehicle} onChange={handleSingleChange} error={!!errorFields.current.Vehicle} helperText={errorFields.current.Vehicle ? 'Required' : ' '}>{vehicleOptions.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}</TextField></Grid>

                  {/* Notes */}
                  <Grid item xs={12}><TextField fullWidth multiline rows={2} size="small" label="Ride Notes" name="RideNotes" value={formData.RideNotes} onChange={handleSingleChange} /></Grid>
                </Grid>
              </Box>
            </Fade>
          )}

          {/* MULTI RIDE UPLOAD */}
          {rideTab === 1 && (
            <Fade in>
              <Box sx={{ px: isMobile ? 1 : 3, py: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}><Button fullWidth variant="outlined" startIcon={<DownloadIcon />} href="/ride-template.csv" download>Download Template</Button></Grid>
                  <Grid item xs={12}><Box {...getRootProps()} sx={{ border: '2px dashed', borderColor: isDragActive ? 'success.main' : 'grey.500', p: 4, textAlign: 'center' }}><input {...getInputProps()} /><UploadFileIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} /><Typography>{isDragActive ? 'Drop file here' : 'Drag & drop CSV/XLS here or click to select'}</Typography></Box></Grid>
                  
                  {/* Builder Fields */}
                  <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Trip ID" name="TripID" value={csvBuilder.TripID} onChange={handleCsvBuilderChange} error={!!builderErrors.TripID} helperText={builderErrors.TripID ? 'Required or invalid' : ' '} /></Grid>
                  <Grid item xs={12} sm={4}><DatePicker label="Date" value={csvBuilder.Date ? dayjs(csvBuilder.Date) : null} onChange={(val) => handleCsvBuilderChange({ target: { name: 'Date', value: val?.format('YYYY-MM-DD') || '' } })} slotProps={{ textField: { fullWidth: true, size: 'small', error: !!builderErrors.Date, helperText: builderErrors.Date ? 'Required or invalid' : ' ' } }} /></Grid>
                  <Grid item xs={12} sm={4}><TimePicker label="Pickup Time" value={csvBuilder.PickupTime ? dayjs(`2000-01-01T${csvBuilder.PickupTime}`) : null} onChange={(val) => handleCsvBuilderChange({ target: { name: 'PickupTime', value: val?.format('HH:mm') || '' } })} slotProps={{ textField: { fullWidth: true, size: 'small', error: !!builderErrors.PickupTime, helperText: builderErrors.PickupTime ? 'Required or invalid' : ' ' } }} /></Grid>

                  <Grid item xs={6} sm="auto"><TextField sx={{ maxWidth: 90 }} fullWidth size="small" label="Hours" name="DurationHours" type="number" InputProps={{ endAdornment: <InputAdornment position="end">h</InputAdornment> }} value={csvBuilder.DurationHours} onChange={handleCsvBuilderChange} error={!!builderErrors.DurationHours} helperText={builderErrors.DurationHours ? 'Invalid' : ' '} /></Grid>
                  <Grid item xs={6} sm="auto"><TextField sx={{ maxWidth: 90 }} fullWidth size="small" label="Minutes" name="DurationMinutes" type="number" InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }} value={csvBuilder.DurationMinutes} onChange={handleCsvBuilderChange} error={!!builderErrors.DurationMinutes} helperText={builderErrors.DurationMinutes ? 'Invalid' : ' '} /></Grid>

                  <Grid item xs={12} sm><TextField fullWidth select size="small" label="Ride Type" name="RideType" value={csvBuilder.RideType} onChange={handleCsvBuilderChange} error={!!builderErrors.RideType} helperText={builderErrors.RideType ? 'Required' : ' '}>{rideTypeOptions.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}</TextField></Grid>
                  <Grid item xs={12} sm><TextField fullWidth select size="small" label="Vehicle" name="Vehicle" value={csvBuilder.Vehicle} onChange={handleCsvBuilderChange} error={!!builderErrors.Vehicle} helperText={builderErrors.Vehicle ? 'Required' : ' '}>{vehicleOptions.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}</TextField></Grid>

                  <Grid item xs={12}><TextField fullWidth multiline rows={2} size="small" label="Ride Notes" name="RideNotes" value={csvBuilder.RideNotes} onChange={handleCsvBuilderChange} /></Grid>
                </Grid>
              </Box>
            </Fade>
          )}
        </Paper>
      </Box>
    </LocalizationProvider>
  );
}
