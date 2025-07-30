// src/components/TicketGenerator.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Button, TextField, Typography, Paper, Divider, Modal, Snackbar, Alert, Stack, Autocomplete, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import QRCode from 'react-qr-code';
import dayjs from 'dayjs';
import { toPng } from 'html-to-image';
import { v4 as uuidv4 } from 'uuid';
import { addTicket as apiAddTicket, emailTicket as apiEmailTicket } from '../hooks/api';

const getStoredLocations = (key) => JSON.parse(localStorage.getItem(key) || '[]');
const storeLocation = (key, value) => {
  const stored = new Set(getStoredLocations(key));
  stored.add(value);
  localStorage.setItem(key, JSON.stringify([...stored].slice(-5)));
};

export default function TicketGenerator() {
  const [formData, setFormData] = useState({
    passenger: '', date: '', time: '', pickup: '', dropoff: '', passengerCount: '', notes: ''
  });
  const [errors, setErrors] = useState({});
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openPreview, setOpenPreview] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const ticketRef = useRef(null);
  const [emailSending, setEmailSending] = useState(false);
  const pickupOptions = getStoredLocations('lrp_pickup');
  const dropoffOptions = getStoredLocations('lrp_dropoff');

  const validate = () => {
    const newErrors = {};
    if (!formData.passenger.trim()) newErrors.passenger = 'Passenger name is required';
    if (!formData.date) newErrors.date = 'Pick-up date is required';
    if (!formData.time) newErrors.time = 'Pick-up time is required';
    if (formData.date === dayjs().format('YYYY-MM-DD') && dayjs(formData.time, 'HH:mm').isBefore(dayjs())) {
      newErrors.time = 'Time appears to be in the past';
    }
    if (!formData.pickup.trim()) newErrors.pickup = 'Pickup location is required';
    if (!formData.dropoff.trim()) newErrors.dropoff = 'Dropoff location is required';
    const count = parseInt(formData.passengerCount, 10);
    if (!formData.passengerCount) {
      newErrors.passengerCount = 'Passenger count is required';
    } else if (isNaN(count) || count < 1 || count > 37) {
      newErrors.passengerCount = 'Must be a number between 1 and 37';
    }
    if (formData.notes.length > 300) {
      newErrors.notes = 'Notes too long';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field) => (e, val) => {
    const value = typeof e === 'string' ? e : (e.target?.value ?? val ?? '');
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!validate() || loading) return;
    setLoading(true);
    const id = uuidv4().split('-')[0];
    const ticketId = `TICKET-${id.toUpperCase()}`;
    const createdAt = dayjs().format('YYYY-MM-DD HH:mm');

    const newTicket = {
      ...formData,
      ticketId,
      createdAt,
      scannedOutbound: false,
      scannedReturn: false,
      passengerCount: parseInt(formData.passengerCount, 10)
    };

    try {
      const result = await apiAddTicket(newTicket);
      if (result.success) {
        setTicket(newTicket);
        setFormData({ passenger: '', date: '', time: '', pickup: '', dropoff: '', passengerCount: '', notes: '' });
        storeLocation('lrp_pickup', newTicket.pickup);
        storeLocation('lrp_dropoff', newTicket.dropoff);
        setOpenPreview(true);
      } else {
        setSnackbar({ open: true, message: '❌ Failed to save ticket to Google Sheets', severity: 'error' });
      }
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: '🚨 Error communicating with ticket API', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const downloadTicket = async () => {
    if (!ticketRef.current || !ticket) return;
    try {
      const dataUrl = await toPng(ticketRef.current, { backgroundColor: '#fff' });
      const link = document.createElement('a');
      link.download = `${ticket.ticketId}.png`;
      link.href = dataUrl;
      link.click();
      setSnackbar({ open: true, message: '📸 Ticket saved as image', severity: 'success' });
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: '❌ Failed to generate image', severity: 'error' });
    }
  };

  const emailTicket = async () => {
    if (!ticketRef.current || !ticket || !emailAddress) return;
    setEmailSending(true);
    try {
      await new Promise((res) => setTimeout(res, 250)); // Ensure DOM is rendered
      const dataUrl = await toPng(ticketRef.current, { backgroundColor: '#fff' });
      const base64 = dataUrl.split(',')[1];
  
      const result = await apiEmailTicket(ticket.ticketId, emailAddress, base64);
      if (result.success) {
        setSnackbar({ open: true, message: '📧 Ticket emailed', severity: 'success' });
      } else throw new Error('Failed');
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: '❌ Email failed', severity: 'error' });
    } finally {
      setEmailSending(false);
      setEmailDialogOpen(false);
      setEmailAddress('');
    }
  };
  
  

  const handlePrint = () => {
    const contents = ticketRef.current.innerHTML;
    const win = window.open('', 'Print', 'height=600,width=400');
    if (!win) return;
    win.document.write('<html><head><title>Ticket</title><style>body{background:#fff;color:#000;padding:20px;font-family:sans-serif;} img{display:block;margin:auto;}</style></head><body>');
    win.document.write(contents);
    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const handleClosePreview = () => {
    setOpenPreview(false);
    setTicket(null);
  };
  return (
    <Box sx={{ maxWidth: 500, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        🚌 Generate Shuttle Ticket
      </Typography>

      <form onSubmit={handleGenerate}>
  <Paper sx={{ p: 3, mb: 3 }} elevation={4}>
    <TextField fullWidth label="Passenger Name" sx={{ mb: 2 }} autoFocus
      value={formData.passenger} onChange={handleChange('passenger')}
      error={!!errors.passenger} helperText={errors.passenger}
    />
    <TextField fullWidth type="date" label="Pick-up Date" sx={{ mb: 2 }}
      value={formData.date} onChange={handleChange('date')}
      error={!!errors.date} helperText={errors.date} InputLabelProps={{ shrink: true }}
    />
    <TextField fullWidth type="time" label="Pick-up Time" sx={{ mb: 2 }}
      value={formData.time} onChange={handleChange('time')}
      error={!!errors.time} helperText={errors.time} InputLabelProps={{ shrink: true }}
    />
    <Autocomplete freeSolo options={pickupOptions} inputValue={formData.pickup}
      onInputChange={(_, value) => handleChange('pickup')(value)}
      renderInput={(params) => (
        <TextField {...params} label="Pickup Location" sx={{ mb: 2 }}
          error={!!errors.pickup} helperText={errors.pickup} />
      )}
    />
    <Autocomplete freeSolo options={dropoffOptions} inputValue={formData.dropoff}
      onInputChange={(_, value) => handleChange('dropoff')(value)}
      renderInput={(params) => (
        <TextField {...params} label="Dropoff Location" sx={{ mb: 2 }}
          error={!!errors.dropoff} helperText={errors.dropoff} />
      )}
    />
    <TextField fullWidth type="number" label="Passenger Count" inputProps={{ min: 1, max: 37 }}
      sx={{ mb: 2 }} value={formData.passengerCount} onChange={handleChange('passengerCount')}
      error={!!errors.passengerCount} helperText={errors.passengerCount} />
    <TextField fullWidth label="Notes" sx={{ mb: 2 }} multiline maxRows={4}
      value={formData.notes} onChange={handleChange('notes')}
      error={!!errors.notes} helperText={errors.notes} />
    <Button variant="contained" type="submit" fullWidth disabled={loading}>
      {loading ? 'Generating…' : 'Generate Ticket'}
    </Button>
  </Paper>
</form>

      <Modal open={openPreview} onClose={handleClosePreview}>
        <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, p: 4, width: 360, mx: 'auto', mt: '10vh', boxShadow: 24, outline: 'none' }}>
          {ticket ? (
            <>
              <Box ref={ticketRef} sx={{ backgroundColor: '#fff', color: '#000', p: 3, borderRadius: 2, width: '100%', maxWidth: 320, mx: 'auto' }}>
                <Box display="flex" justifyContent="center" mb={2}>
                  <img src="./android-chrome-512x512.png" alt="Lake Ride Pros" style={{ height: 48, objectFit: 'contain' }} />
                </Box>
                <Typography variant="h6" fontWeight="bold" align="center">🎟️ Shuttle Ticket</Typography>
                <Divider sx={{ mb: 2 }} />
                <Typography><strong>Passenger:</strong> {ticket.passenger}</Typography>
                <Typography><strong>Passenger Count:</strong> {ticket.passengerCount}</Typography>
                <Typography><strong>Date:</strong> {ticket.date}</Typography>
                <Typography><strong>Time:</strong> {ticket.time} CST</Typography>
                <Typography><strong>Pickup:</strong> {ticket.pickup}</Typography>
                <Typography><strong>Dropoff:</strong> {ticket.dropoff}</Typography>
                {ticket.notes && <Typography><strong>Notes:</strong> {ticket.notes}</Typography>}
                <Typography sx={{ mt: 1 }}><strong>Ticket ID:</strong> {ticket.ticketId}</Typography>
                <Box mt={3} display="flex" justifyContent="center">
                  <Box sx={{ p: 2, bgcolor: '#fff' }}>
                    <QRCode value={`https://lakeridepros.xyz/ticket/${ticket.ticketId}`} size={160} />
                  </Box>
                </Box>
              </Box>
              <Stack spacing={1} direction={{ xs: 'column', sm: 'row' }} mt={3}>
                <Button variant="outlined" onClick={handlePrint}>Print</Button>
                <Button variant="contained" color="success" onClick={downloadTicket}>Download</Button>
                <Button variant="outlined" color="info" onClick={() => setEmailDialogOpen(true)}>Email</Button>
                <Button variant="text" onClick={handleClosePreview}>Close</Button>
              </Stack>
            </>
          ) : (
            <Typography align="center">Loading ticket preview…</Typography>
          )}
        </Box>
      </Modal>

      <Modal open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)}>
  <Box sx={{ backgroundColor: 'background.paper', p: 3, borderRadius: 2, width: 300, mx: 'auto', mt: '20vh', boxShadow: 24 }}>
    <Typography variant="h6" gutterBottom>Email Ticket</Typography>
    <TextField
      fullWidth
      label="Email Address"
      value={emailAddress}
      onChange={(e) => setEmailAddress(e.target.value)}
      type="email"
      autoFocus
      disabled={emailSending}
      sx={{ mb: 2 }}
    />
    <Stack direction="row" spacing={2} justifyContent="flex-end">
      <Button onClick={() => setEmailDialogOpen(false)} disabled={emailSending}>Cancel</Button>
      <Button
        onClick={emailTicket}
        variant="contained"
        color="primary"
        disabled={!emailAddress || emailSending}
      >
        {emailSending ? 'Sending…' : 'Send'}
      </Button>
    </Stack>
  </Box>
</Modal>


      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar((s) => ({ ...s, open: false }))} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
