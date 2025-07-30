/* Proprietary and confidential. See LICENSE. */
// Tickets.jsx — Email, Download, Search, Summary, Scanner Status
import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import dayjs from 'dayjs';
import QRCode from 'react-qr-code';
import { toPng } from 'html-to-image';
import {
  Box, Typography, Paper, Divider, Button, Modal, TextField, IconButton,
  MenuItem, Select, InputLabel, FormControl, Snackbar, Alert, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import EmailIcon from '@mui/icons-material/Email';
import { motion } from 'framer-motion';
import { fetchTickets, deleteTicket as apiDeleteTicket, emailTicket as apiEmailTicket } from '../hooks/api';

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [filteredDate, setFilteredDate] = useState('All Dates');
  const [editOpen, setEditOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [deletingId, setDeletingId] = useState(null);
  const [tab, setTab] = useState(0);
  const [previewTicket, setPreviewTicket] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const previewRef = useRef(null);

  const loadTickets = () => {
    fetchTickets()
      .then((data) => Array.isArray(data) ? setTickets(data) : console.error('Invalid data format'))
      .catch((err) => console.error('Fetch error:', err));
  };

  useEffect(() => { loadTickets(); }, []);

  const filteredTickets = tickets.filter((t) => {
    const matchDate = filteredDate === 'All Dates' || (dayjs(t.date).isValid()
      ? dayjs(t.date).format('MM-DD-YYYY') === filteredDate
      : t.date === filteredDate);

    const matchSearch = [t.passenger, t.ticketId].join(' ').toLowerCase().includes(searchQuery.toLowerCase());

    return matchDate && matchSearch;
  });

  const passengerSummary = filteredTickets.reduce((acc, t) => {
    const date = dayjs(t.date).isValid() ? dayjs(t.date).format('MM-DD-YYYY') : t.date || 'Unknown';
    const count = parseInt(t.passengercount || t.passengerCount || '0', 10);
    acc[date] = (acc[date] || 0) + count;
    return acc;
  }, {});
  const downloadTicket = async () => {
    if (!previewRef.current || !previewTicket) return;
    try {
      const dataUrl = await toPng(previewRef.current, { backgroundColor: '#fff' });
      const link = document.createElement('a');
      link.download = `${previewTicket.ticketId}.png`;
      link.href = dataUrl;
      link.click();
      setSnackbar({ open: true, message: '📸 Ticket saved as image', severity: 'success' });
    } catch (err) {
      console.error('Download failed', err);
      setSnackbar({ open: true, message: '❌ Failed to generate image', severity: 'error' });
    }
  };

  const handleDelete = async (ticketId) => {
    const confirmDelete = window.confirm(`Delete ticket ${ticketId}?`);
    if (!confirmDelete) return;
  
    setDeletingId(ticketId);
    try {
      const data = await apiDeleteTicket(ticketId);
      if (data.success) {
        setTickets((prev) => prev.filter((t) => t.ticketId !== ticketId));
        setSnackbar({ open: true, message: '🗑️ Ticket deleted', severity: 'success' });
      } else {
        throw new Error('Delete failed');
      }
    } catch (err) {
      console.error('Delete error:', err);
      setSnackbar({ open: true, message: '❌ Failed to delete ticket', severity: 'error' });
    } finally {
      setDeletingId(null);
    }
  };
  

  const bulkDownload = async () => {
    const selected = tickets.filter(t => selectedIds.includes(t.ticketId));
    for (const ticket of selected) {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const root = ReactDOM.createRoot(container);
      root.render(
        <Box sx={{ p: 2, width: 360, backgroundColor: '#fff', borderRadius: 2, color: '#000' }}>
          <Box display="flex" justifyContent="center" mb={2}>
            <img src="/android-chrome-512x512.png" alt="Lake Ride Pros" style={{ height: 48 }} />
          </Box>
          <Typography variant="h6" align="center" gutterBottom>🎟️ Shuttle Ticket</Typography>
          <Divider sx={{ mb: 2 }} />
          <Typography><strong>Passenger:</strong> {ticket.passenger}</Typography>
          <Typography><strong>Passenger Count:</strong> {ticket.passengercount}</Typography>
          <Typography><strong>Date:</strong> {ticket.date}</Typography>
          <Typography><strong>Time:</strong> {ticket.time}</Typography>
          <Typography><strong>Pickup:</strong> {ticket.pickup}</Typography>
          <Typography><strong>Dropoff:</strong> {ticket.dropoff}</Typography>
          {ticket.notes && <Typography><strong>Notes:</strong> {ticket.notes}</Typography>}
          <Typography><strong>Ticket ID:</strong> {ticket.ticketId}</Typography>
          <Box mt={2} display="flex" justifyContent="center">
            <QRCode value={`https://lakeridepros.xyz/ticket/${ticket.ticketId}`} size={160} />
          </Box>
        </Box>
      );

      await new Promise(res => setTimeout(res, 250));

      try {
        const dataUrl = await toPng(container);
        const link = document.createElement('a');
        link.download = `${ticket.ticketId}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Bulk download failed', err);
      } finally {
        root.unmount();
        document.body.removeChild(container);
      }
    }
    setSnackbar({ open: true, message: '📦 Bulk tickets downloaded', severity: 'success' });
  };

  const emailTicket = async () => {
    if (!previewRef.current || !previewTicket || !emailAddress) return;
    try {
      const dataUrl = await toPng(previewRef.current, { backgroundColor: '#fff' });
      const base64 = dataUrl.split(',')[1];
      const data = await apiEmailTicket(previewTicket.ticketId, emailAddress, base64);
      if (data.success) {
        setSnackbar({ open: true, message: '📧 Ticket emailed', severity: 'success' });
      } else throw new Error('Email failed');
    } catch (err) {
      console.error('Email error:', err);
      setSnackbar({ open: true, message: '❌ Email failed', severity: 'error' });
    }
    setEmailDialogOpen(false);
    setEmailAddress('');
  };

  const columns = [
    {
      field: 'actions', headerName: '', width: 160, sortable: false,
      renderCell: (params) => (
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton size="small" color="primary" onClick={() => setSelectedTicket(params.row)}><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={() => handleDelete(params.row.ticketId)} disabled={deletingId === params.row.ticketId}><DeleteIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="success" onClick={() => setPreviewTicket(params.row)}><DownloadIcon fontSize="small" /></IconButton>
        </Box>
      ),
    },
    { field: 'passenger', headerName: 'Passenger', minWidth: 130, flex: 1 },
    { field: 'date', headerName: 'Date', minWidth: 110 },
    { field: 'pickup', headerName: 'Pickup', minWidth: 110 },
    {
      field: 'ticketId', headerName: 'Link', minWidth: 100, sortable: false,
      renderCell: (params) => <a href={`/ticket/${params.value}`} target="_blank" rel="noopener noreferrer" style={{ color: '#00f' }}>View</a>
    },
    {
      field: 'scanStatus', headerName: 'Scan', minWidth: 120,
      renderCell: ({ row }) => {
        if (row.scannedReturn) return '✅ Return';
        if (row.scannedOutbound) return '↗️ Outbound';
        return '❌ Not Scanned';
      }
    },
  ];
  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', mt: 4, px: { xs: 1, sm: 3 } }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>🎟️ Shuttle Ticket Overview</Typography>

      <Box display="flex" justifyContent="space-between" flexWrap="wrap" gap={2} mb={2}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Date Filter</InputLabel>
          <Select label="Date Filter" value={filteredDate} onChange={(e) => setFilteredDate(e.target.value)}>
            <MenuItem value="All Dates">All Dates</MenuItem>
            {[...new Set(tickets.map((t) => dayjs(t.date).isValid() ? dayjs(t.date).format('MM-DD-YYYY') : t.date))].sort().map((date) => (
              <MenuItem key={date} value={date}>{date}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Search by Passenger or Ticket ID"
          variant="outlined"
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ flexGrow: 1, minWidth: 200 }}
        />

        <Button onClick={loadTickets} variant="outlined" color="success" startIcon={<RefreshIcon />}>Refresh</Button>
        <Button onClick={bulkDownload} variant="contained" color="secondary" disabled={!selectedIds.length}>Bulk Download</Button>
      </Box>

      <Tabs value={tab} onChange={(_, val) => setTab(val)} sx={{ mb: 2 }}>
        <Tab label="Ticket List" />
        <Tab label="Passenger Summary" />
      </Tabs>

      {tab === 0 && (
        <DataGrid
          rows={filteredTickets.map((t) => ({ id: t.ticketId, ...t }))}
          columns={columns}
          autoHeight
          checkboxSelection
          pageSizeOptions={[5, 10, 25, 100]}
          density="compact"
          disableRowSelectionOnClick
          onRowSelectionModelChange={(ids) => setSelectedIds(ids)}
          rowSelectionModel={selectedIds}
        />
      )}

      {tab === 1 && (
        <Paper sx={{ p: 3 }} elevation={4}>
          <Typography variant="h6" gutterBottom>🧮 Passenger Summary by Date</Typography>
          <Divider sx={{ mb: 2 }} />
          <ul>
            {Object.entries(passengerSummary).sort().map(([date, count]) => (
              <li key={date}><strong>{date}:</strong> {count} passengers</li>
            ))}
          </ul>
        </Paper>
      )}

      <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)}>
        <DialogTitle>Email Ticket</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Email Address"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            type="email"
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
          <Button onClick={emailTicket} variant="contained" color="primary">Send</Button>
        </DialogActions>
      </Dialog>

      <Modal open={!!previewTicket} onClose={() => setPreviewTicket(null)}>
  <Box
    component={motion.div}
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    transition={{ duration: 0.3 }}
    sx={{
      backgroundColor: 'background.paper',
      borderRadius: 2,
      p: 4,
      width: 360,
      mx: 'auto',
      mt: '10vh',
      boxShadow: 24,
    }}
  >
    {previewTicket && (
      <>
        <Box ref={previewRef} sx={{ p: 2, backgroundColor: '#fff', borderRadius: 2, color: '#000' }}>
          <Box display="flex" justifyContent="center" mb={2}>
            <img src="/android-chrome-512x512.png" alt="Lake Ride Pros" style={{ height: 48 }} />
          </Box>
          <Typography variant="h6" align="center" gutterBottom sx={{ color: '#000' }}>
            🎟️ Shuttle Ticket
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Typography><strong>Passenger:</strong> {previewTicket.passenger}</Typography>
          <Typography><strong>Passenger Count:</strong> {previewTicket.passengercount}</Typography>
          <Typography><strong>Date:</strong> {previewTicket.date}</Typography>
          <Typography><strong>Time:</strong> {previewTicket.time}</Typography>
          <Typography><strong>Pickup:</strong> {previewTicket.pickup}</Typography>
          <Typography><strong>Dropoff:</strong> {previewTicket.dropoff}</Typography>
          {previewTicket.notes && (
            <Typography><strong>Notes:</strong> {previewTicket.notes}</Typography>
          )}
          <Typography><strong>Ticket ID:</strong> {previewTicket.ticketId}</Typography>
          <Typography><strong>Scanned By:</strong> {previewTicket.scannedBy || '—'}</Typography>
          <Box mt={2} display="flex" justifyContent="center">
            <Box p={1.5} bgcolor="#fff" borderRadius={2} boxShadow="0 0 10px lime">
              <QRCode value={`https://lakeridepros.xyz/ticket/${previewTicket.ticketId}`} size={160} />
            </Box>
          </Box>
        </Box>

        <Box mt={3} display="flex" justifyContent="space-between">
          <Button
            variant="outlined"
            color="info"
            startIcon={<EmailIcon />}
            onClick={() => setEmailDialogOpen(true)}
          >
            Email
          </Button>
          <Button variant="outlined" color="primary" onClick={() => window.print()}>
            Print
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={downloadTicket}
            sx={{ boxShadow: '0 0 8px 2px lime', fontWeight: 700 }}
          >
            Download
          </Button>
          <Button variant="text" onClick={() => setPreviewTicket(null)}>
            Close
          </Button>
        </Box>
      </>
    )}
  </Box>
</Modal>


      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
