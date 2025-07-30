/* Proprietary and confidential. See LICENSE. */
// src/components/AdminTimeLog.jsx — God+1 Mode (Patched for Date Safety)
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box, Paper, Typography, IconButton, TextField, InputAdornment, Tooltip,
  CircularProgress, FormControlLabel, Checkbox, Table, TableBody, TableCell, TableHead, TableRow,
  Alert, Snackbar, useMediaQuery, Tabs, Tab
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import { DataGrid } from '@mui/x-data-grid';
import Papa from 'papaparse';
import { useTheme } from '@mui/material/styles';
import isoWeek from 'dayjs/plugin/isoWeek';
dayjs.extend(isoWeek);


const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlmQyi2ohRZAyez3qMsO3E7aWWIYSDP3El4c3tyY1G-ztdjxnUHI6tNqJgbe9yGcjFht3qmwMnTIvq/pub?gid=888251608&single=true&output=csv';

const baseColumns = [
  { field: 'id', headerName: '#', width: 60 },
  { field: 'Driver', headerName: 'Driver', width: 160 },
  { field: 'RideID', headerName: 'Ride ID', width: 150 },
  { field: 'StartTime', headerName: 'Start Time', width: 200 },
  { field: 'EndTime', headerName: 'End Time', width: 200 },
  { field: 'Duration', headerName: 'Duration (hrs)', width: 140 },
  { field: 'LoggedAt', headerName: 'Logged At', width: 200 },
];

export default function AdminTimeLog() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [weeklySummary, setWeeklySummary] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const [showColumns, setShowColumns] = useState(baseColumns.reduce((acc, col) => ({ ...acc, [col.field]: true }), {}));
  const [tab, setTab] = useState(0);

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const loadData = useCallback(() => {
    setLoading(true);
    Papa.parse(SHEET_CSV_URL, {
      download: true,
      header: true,
      complete: (results) => {
        try {
          const cleaned = results.data
            .filter((row) => row.Driver && row.RideID)
            .map((row, i) => {
              const durationMin = !isNaN(parseFloat(row.Duration)) ? parseFloat(row.Duration) : 0;
              const startTime = dayjs(row.StartTime);
              const endTime = dayjs(row.EndTime);
              const loggedAt = dayjs(row.LoggedAt);

              return {
                id: i + 1,
                Driver: row.Driver,
                RideID: row.RideID,
                StartTime: startTime.isValid() ? startTime.format('MM/DD/YYYY HH:mm') : 'Missing',
                EndTime: endTime.isValid() ? endTime.format('MM/DD/YYYY HH:mm') : 'Missing',
                Duration: (durationMin / 60).toFixed(2),
                LoggedAt: loggedAt.isValid() ? loggedAt.format('MM/DD/YYYY HH:mm') : 'Missing',
                rawStart: row.StartTime,
                rawEnd: row.EndTime,
              };
            });

          setRows(cleaned);
          aggregateWeekly(cleaned);
          detectIssues(cleaned);
        } catch (err) {
          console.error('Processing error:', err);
          setToast({ open: true, message: '❌ Failed to process data', severity: 'error' });
        } finally {
          setLoading(false);
        }
      },
    });
  }, []);

  const aggregateWeekly = (entries) => {
    const grouped = {};
    entries.forEach((entry) => {
      const dt = dayjs(entry.StartTime, 'MM/DD/YYYY HH:mm');
      if (!dt.isValid() || typeof dt.isoWeek !== 'function') return;
  
      const week = dt.isoWeek();
      const year = dt.startOf('isoWeek').year(); // ✅ Safe ISO year fallback
      const key = `${entry.Driver}__${year}-W${week}`;
  
      if (!grouped[key]) {
        grouped[key] = { driver: entry.Driver, week: `${year} W${week}`, total: 0 };
      }
  
      grouped[key].total += parseFloat(entry.Duration);
    });
  
    setWeeklySummary(
      Object.values(grouped).sort((a, b) => b.week.localeCompare(a.week))
    );
  }; 

  const detectIssues = (entries) => {
    const flagged = entries.filter((entry) => {
      return !entry.rawEnd || parseFloat(entry.Duration) === 0 || parseFloat(entry.Duration) > 10;
    });
    setIssues(flagged);
  };

  useEffect(() => { loadData(); }, [loadData]);

  const filteredRows = useMemo(() =>
    rows.filter((r) =>
      (r.Driver || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.RideID || '').toLowerCase().includes(search.toLowerCase())
    ),
    [rows, search]
  );

  const visibleColumns = baseColumns.filter((col) => showColumns[col.field]);

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, py: 3 }}>
      <Tabs value={tab} onChange={(e, newVal) => setTab(newVal)} variant="fullWidth" sx={{ mb: 2 }}>
        <Tab label="Log Table" />
        <Tab label="Weekly Summary" />
        <Tab label="Flagged Issues" />
      </Tabs>

      {tab === 0 && (
        <>
          <Paper sx={{ p: 2, mb: 3, borderLeft: '5px solid #4cbb17' }}>
            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2}>
              <Typography variant="h6">🧾 Time Log Dashboard</Typography>
              <Tooltip title="Reload Data">
                <IconButton onClick={loadData}><RefreshIcon /></IconButton>
              </Tooltip>
            </Box>

            <TextField
              fullWidth
              label="Search by Driver or Ride ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{ endAdornment: (<InputAdornment position="end"><SearchIcon /></InputAdornment>) }}
              sx={{ my: 2 }}
            />

            <Box display="flex" flexDirection="row" flexWrap="wrap" gap={1}>
              {baseColumns.map((col) => (
                <FormControlLabel
                  key={col.field}
                  control={<Checkbox checked={showColumns[col.field]} onChange={() => setShowColumns((prev) => ({ ...prev, [col.field]: !prev[col.field] }))} />}
                  label={col.headerName}
                />
              ))}
            </Box>
          </Paper>

          <Paper sx={{ p: 1, mb: 4, backgroundColor: isDark ? 'grey.900' : 'background.paper' }}>
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" height={360}>
                <CircularProgress />
              </Box>
            ) : (
              <Box sx={{ width: '100%' }}>
                <DataGrid
                  autoHeight
                  rows={filteredRows}
                  columns={visibleColumns}
                  pageSize={isMobile ? 5 : 10}
                  pageSizeOptions={[5, 10, 20, 50]}
                  getRowClassName={(params) => {
                    const hrs = parseFloat(params.row.Duration);
                    if (!params.row.rawEnd || hrs === 0) return 'row-zero';
                    if (hrs > 10) return 'row-long';
                    return '';
                  }}
                  sx={{
                    '& .row-zero': { backgroundColor: '#fff3cd' },
                    '& .row-long': { backgroundColor: '#f8d7da' },
                    '& .MuiDataGrid-row:hover': { backgroundColor: isDark ? '#333' : 'grey.100' },
                    backgroundColor: isDark ? '#2a2a2a' : '#fafafa',
                    fontSize: '0.85rem',
                  }}
                />
              </Box>
            )}
          </Paper>
        </>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 2, borderLeft: '5px solid #4cbb17' }}>
          <Typography variant="h6" gutterBottom>📊 Weekly Summary (Mon–Sun)</Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Driver</TableCell>
                  <TableCell>Week</TableCell>
                  <TableCell>Total Duration (hrs)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {weeklySummary.map((row, i) => (
                  <TableRow key={i} sx={{ backgroundColor: isDark ? 'grey.800' : undefined, '&:hover': { backgroundColor: isDark ? 'grey.700' : 'grey.100' } }}>
                    <TableCell>{row.driver}</TableCell>
                    <TableCell>{row.week}</TableCell>
                    <TableCell>{row.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}

      {tab === 2 && (
        <Paper sx={{ p: 2, borderLeft: '5px solid #ffa500' }}>
          <Typography variant="h6" gutterBottom>🚨 Flagged Log Issues</Typography>
          {issues.length === 0 ? (
            <Alert severity="success">No issues detected. All entries look good.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Driver</TableCell>
                  <TableCell>RideID</TableCell>
                  <TableCell>Start</TableCell>
                  <TableCell>End</TableCell>
                  <TableCell>Duration</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {issues.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{row.Driver}</TableCell>
                    <TableCell>{row.RideID}</TableCell>
                    <TableCell>{row.StartTime}</TableCell>
                    <TableCell>{row.EndTime}</TableCell>
                    <TableCell>{row.Duration}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      )}

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast({ ...toast, open: false })}>
        <Alert severity={toast.severity} variant="filled">{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
