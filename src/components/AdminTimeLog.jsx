/* Proprietary and confidential. See LICENSE. */ // src/components/AdminTimeLog.jsx — enhanced Admin Logs portal (patched) import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'; import { Box, Paper, Typography, IconButton, TextField, InputAdornment, Tooltip, CircularProgress, FormControlLabel, Checkbox, Menu, MenuItem, Button, Tabs, Tab, Stack, Autocomplete, Chip, Dialog, DialogTitle, DialogContent, Divider, useMediaQuery, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, } from '@mui/material'; import RefreshIcon from '@mui/icons-material/Refresh'; import SearchIcon from '@mui/icons-material/Search'; import TableChartIcon from '@mui/icons-material/TableChart'; import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'; import FlagIcon from '@mui/icons-material/Flag'; import { DataGrid } from '@mui/x-data-grid'; import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers'; import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'; import dayjs from 'dayjs'; import isoWeek from 'dayjs/plugin/isoWeek'; import Papa from 'papaparse'; import { useTheme } from '@mui/material/styles';

dayjs.extend(isoWeek);

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlmQyi2ohRZAyez3qMsO3E7aWWIYSDP3El4c3tyY1G-ztdjxnUHI6tNJgbe9yGcjFht3qmwMn' + 'TIvq/pub?gid=888251608&single=true&output=csv';

const baseColumns = [ { field: 'id', headerName: '#', width: 60 }, { field: 'Driver', headerName: 'Driver', flex: 1, minWidth: 160 }, { field: 'RideID', headerName: 'Ride ID', width: 150 }, { field: 'StartTime', headerName: 'Start Time', flex: 1, minWidth: 180 }, { field: 'EndTime', headerName: 'End Time', flex: 1, minWidth: 180 }, { field: 'Duration', headerName: 'Duration', width: 110 }, { field: 'LoggedAt', headerName: 'Logged At', flex: 1, minWidth: 180 }, ];

const DURATION_THRESHOLD_MINUTES = 10 * 60; // configurable duration threshold

const durationFormat = (mins) => { if (mins == null) return ''; const h = Math.floor(mins / 60); const m = Math.abs(mins % 60).toString().padStart(2, '0'); return ${h}:${m}; };

export default function AdminTimeLog() { const theme = useTheme(); const isDark = theme.palette.mode === 'dark'; const isMobile = useMediaQuery(theme.breakpoints.down('sm')); const isMounted = useRef(true);

// data states const [rows, setRows] = useState([]); const [issues, setIssues] = useState([]);

// ui states const [loading, setLoading] = useState(false); const [tab, setTab] = useState(0); const [anchorEl, setAnchorEl] = useState(null); const [dialogIssue, setDialogIssue] = useState(null);

// table controls const [searchInput, setSearchInput] = useState(''); const [search, setSearch] = useState(''); const [columnVisibility, setColumnVisibility] = useState(() => { const saved = localStorage.getItem('logColumnVisibility'); const defaultCols = baseColumns.reduce((acc, c) => ({ ...acc, [c.field]: true }), {}); if (saved) { try { const parsed = JSON.parse(saved); return { ...defaultCols, ...parsed }; } catch { return defaultCols; } } return defaultCols; }); const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: isMobile ? 5 : 10, });

// weekly summary filters const [week, setWeek] = useState(dayjs().startOf('isoWeek')); const [driverFilter, setDriverFilter] = useState(null);

// debounce search input useEffect(() => { const t = setTimeout(() => setSearch(searchInput), 300); return () => clearTimeout(t); }, [searchInput]);

// persist column visibility useEffect(() => { localStorage.setItem('logColumnVisibility', JSON.stringify(columnVisibility)); }, [columnVisibility]);

useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);

const safeParseDate = (val) => { const d = dayjs(val); return d.isValid() ? d : null; };

const loadData = useCallback(() => { setLoading(true); Papa.parse(SHEET_CSV_URL, { download: true, header: true, complete: (results) => { try { const cleaned = results.data .filter((row) => row.Driver && row.RideID) .map((row, i) => { const start = safeParseDate(row.StartTime); const end = safeParseDate(row.EndTime); const logged = safeParseDate(row.LoggedAt); let duration = null; if (start && end) { duration = end.diff(start, 'minute'); if (duration < 0) duration = 0; } return { id: i + 1, Driver: row.Driver, RideID: row.RideID, StartTime: start ? start.format('MM/DD/YYYY HH:mm') : 'Missing', EndTime: end ? end.format('MM/DD/YYYY HH:mm') : 'In Progress', Duration: durationFormat(duration), LoggedAt: logged ? logged.format('MM/DD/YYYY HH:mm') : 'Missing', rawStart: row.StartTime, rawEnd: row.EndTime, rawLogged: row.LoggedAt, durationMin: duration, }; }); if (isMounted.current) { setRows(cleaned); detectIssues(cleaned); } } catch (err) { console.error(err); } finally { if (isMounted.current) setLoading(false); } }, }); }, []);

useEffect(() => { loadData(); }, [loadData]);

// filter rows const filteredRows = useMemo(() => { if (!search) return rows; return rows.filter( (r) => (r.Driver || '').toLowerCase().includes(search.toLowerCase()) || (r.RideID || '').toLowerCase().includes(search.toLowerCase()) ); }, [rows, search]);

// weekly summary calculation const summary = useMemo(() => { const startWeek = week.startOf('isoWeek'); const endWeek = startWeek.add(7, 'day'); const weekRows = rows.filter((r) => { const st = safeParseDate(r.rawStart); return st && st.isAfter(startWeek) && st.isBefore(endWeek); });

const grouped = {};
weekRows.forEach((r) => {
  if (driverFilter && r.Driver !== driverFilter) return;
  if (!grouped[r.Driver]) grouped[r.Driver] = { hours: 0, rides: 0 };
  grouped[r.Driver].hours += r.durationMin || 0;
  grouped[r.Driver].rides += 1;
});

const data = Object.entries(grouped).map(([driver, v]) => {
  const driverIssues = issues.filter((i) => i.Driver === driver).length;
  return {
    id: driver,
    Driver: driver,
    TotalHours: v.hours / 60,
    TotalRides: v.rides,
    AvgDuration: v.rides ? v.hours / v.rides / 60 : 0,
    Flagged: driverIssues,
  };
});
return data;

}, [rows, week, driverFilter, issues]);

const summaryTotals = useMemo(() => { const hours = summary.reduce((acc, r) => acc + r.TotalHours, 0); const rides = summary.reduce((acc, r) => acc + r.TotalRides, 0); const issuesCount = summary.reduce((acc, r) => acc + r.Flagged, 0); return { Driver: 'Total', TotalHours: hours, TotalRides: rides, AvgDuration: rides ? hours / rides : 0, Flagged: issuesCount, }; }, [summary]);

// issue detection (deduplicate overlaps) const detectIssues = (entries) => { const seenOverlaps = new Set(); const grouped = entries.reduce((acc, r) => { acc[r.Driver] = acc[r.Driver] || []; acc[r.Driver].push(r); return acc; }, {}); const res = []; Object.values(grouped).forEach((arr) => { const sorted = arr.sort((a, b) => dayjs(a.rawStart).valueOf() - dayjs(b.rawStart).valueOf()); for (let i = 0; i < sorted.length; i++) { const r = sorted[i]; const start = safeParseDate(r.rawStart); const end = safeParseDate(r.rawEnd); if (!end) { res.push({ ...r, type: 'Missing End Time', severity: 'critical', details: 'Driver did not clock out' }); } else { const dur = end.diff(start, 'minute'); if (dur < 0) { res.push({ ...r, type: 'Negative Duration', severity: 'critical', details: 'End before start' }); } if (dur > DURATION_THRESHOLD_MINUTES) { res.push({ ...r, type: 'Long Duration', severity: 'warning', details: Duration ${durationFormat(dur)} }); } const next = sorted[i + 1]; if (next) { const nextStart = safeParseDate(next.rawStart); if (nextStart && nextStart.isBefore(end)) { const key = ${r.Driver}-${r.RideID}-${next.RideID}; if (!seenOverlaps.has(key)) { res.push({ ...next, type: 'Overlap', severity: 'critical', details: Overlaps with ride ${r.RideID}, }); seenOverlaps.add(key); } } } } } }); setIssues(res); };

// column controls menu handlers const allSelected = Object.values(columnVisibility).every(Boolean); const toggleAll = () => { const next = baseColumns.reduce((acc, c) => ({ ...acc, [c.field]: !allSelected }), {}); setColumnVisibility(next); };

const columnControl = ( <Box> <Button onClick={toggleAll} size="small" sx={{ mb: 1 }}> {allSelected ? 'Deselect All' : 'Select All'} </Button> <Stack direction="column"> {baseColumns.map((col) => ( <FormControlLabel key={col.field} control={ <Checkbox checked={columnVisibility[col.field]} onChange={() => setColumnVisibility((prev) => ({ ...prev, [col.field]: !prev[col.field] })) } /> } label={col.headerName} /> ))} </Stack> </Box> );

const handleRowClick = (params) => setDialogIssue(params.row);

const issueColumns = [ { field: 'Driver', headerName: 'Driver', flex: 1 }, { field: 'RideID', headerName: 'Ride ID', width: 130 }, { field: 'type', headerName: 'Issue Type', width: 150, renderCell: (params) => ( <Chip label={params.value} color={params.row.severity === 'critical' ? 'error' : 'warning'} size="small" /> ), }, { field: 'details', headerName: 'Details', flex: 1, renderCell: (params) => ( <Tooltip title={params.value}> <span>{params.value}</span> </Tooltip> ), }, { field: 'LoggedAt', headerName: 'Logged At', width: 180 }, ];

const tabIndicator = { style: { backgroundColor: '#4cbb17', height: 3 } }; const tabStyles = (index) => ({ fontWeight: tab === index ? 'bold' : 'normal', transition: 'all 0.3s', });

const spinAnimation = { animation: loading ? 'spin 2s linear infinite' : 'none', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' }, }, };

return ( <LocalizationProvider dateAdapter={AdapterDayjs}> <Box sx={{ px: { xs: 1, sm: 2 }, py: 3 }}> <Tabs value={tab} onChange={(e, v) => setTab(v)} TabIndicatorProps={tabIndicator} variant="fullWidth" sx={{ mb: 2 }} > <Tab label="Log Table" icon={<TableChartIcon />} iconPosition="start" sx={tabStyles(0)} /> <Tab label="Weekly Summary" icon={<CalendarMonthIcon />} iconPosition="start" sx={tabStyles(1)} /> <Tab label="Flagged Issues" icon={<FlagIcon />} iconPosition="start" sx={tabStyles(2)} /> </Tabs>

{/* Log Table Tab */}
    {tab === 0 && (
      <>
        <Paper sx={{ p: 2, mb: 3, borderLeft: '5px solid #4cbb17' }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
          >
            <Typography variant="h6">Log Table</Typography>
            <Tooltip title="Reload Data">
              <IconButton onClick={loadData} sx={spinAnimation}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>

          <TextField
            fullWidth
            label="Search by Driver or Ride ID"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ my: 2 }}
          />

          {isMobile ? (
            <>
              <Button
                onClick={(e) => setAnchorEl(e.currentTarget)}
                variant="outlined"
                size="small"
              >
                Columns
              </Button>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                <MenuItem disableRipple>{columnControl}</MenuItem>
              </Menu>
            </>
          ) : (
            columnControl
          )}
        </Paper>

        <Paper sx={{ p: 1, mb: 4, backgroundColor: isDark ? 'grey.900' : 'background.paper' }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" height={360}>
              <CircularProgress />
            </Box

              
