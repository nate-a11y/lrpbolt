/* Proprietary and confidential. See LICENSE. */
// RideVehicleCalendar.jsx — Fully updated with vehicle chips, dynamic coloring, compact mode, summary, and improved light mode readability
import React, { useEffect, useState, useMemo } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { TIMEZONE } from '../constants';
import {
  Box, Typography, Button, CircularProgress, Dialog, Stack, Chip,
  useMediaQuery, useTheme, TextField, Switch, Tooltip
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import Autocomplete from '@mui/material/Autocomplete';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';

const API_KEY = import.meta.env.VITE_CALENDAR_API_KEY;
const CALENDAR_ID = import.meta.env.VITE_CALENDAR_ID;
const CST = TIMEZONE;

dayjs.extend(utc);
dayjs.extend(timezone);

export default function RideVehicleCalendar() {
  const [date, setDate] = useState(dayjs().tz(CST));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vehicleFilter, setVehicleFilter] = useState(['ALL']);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(true);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const getVehicleColor = (vehicle) => {
    const stored = JSON.parse(localStorage.getItem('vehicleColors') || '{}');
    if (stored[vehicle]) return stored[vehicle];

    // DJB2-style hash for better string distinction
    let hash = 5381;
    for (let i = 0; i < vehicle.length; i++) {
      hash = (hash * 33) ^ vehicle.charCodeAt(i);
    }
    const hue = Math.abs(hash) % 360;

    // Quantize hue to spread colors farther apart
    const quantizedHue = Math.round(hue / 20) * 20;
    const saturation = theme.palette.mode === 'dark' ? '60%' : '65%';
    const lightness = theme.palette.mode === 'dark' ? '40%' : '55%';

    const color = `hsl(${quantizedHue}, ${saturation}, ${lightness})`;
    stored[vehicle] = color;
    localStorage.setItem('vehicleColors', JSON.stringify(stored));
    return color;
  };
 
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const start = dayjs(date).startOf('day').toISOString();
      const end = dayjs(date).endOf('day').toISOString();

      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        CALENDAR_ID
      )}/events?key=${API_KEY}&timeMin=${start}&timeMax=${end}&singleEvents=true&orderBy=startTime`;

      try {
        const res = await fetch(url);
        const data = await res.json();

        const parsed = (data.items || []).flatMap((item, i, all) => {
          if (/Driver:\s*-/.test(item.description)) return [];
          const desc = (item.description || '').replace('(Lake Ride Pros)', '').trim();
          const vehicle = (desc.match(/Vehicle:\s*(.+)/)?.[1] || 'Unknown').trim();
          const title = item.summary?.replace('(Lake Ride Pros)', '').trim() || 'Untitled';

          const start = dayjs.utc(item.start.dateTime || item.start.date).tz(CST);
          const end = dayjs.utc(item.end.dateTime || item.end.date).tz(CST);

          const prev = all[i - 1];
          const prevEnd = prev ? dayjs.utc(prev.end.dateTime || prev.end.date).tz(CST) : null;
          const tightGap = prev && start.diff(prevEnd, 'minute') <= 10 && vehicle === (prev.description?.match(/Vehicle:\s*(.+)/)?.[1] || '');

          return [{ title, start, end, vehicle, tightGap, description: desc }];
        });

        setEvents(parsed);
      } catch (err) {
        console.error('Calendar fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [date]);

  const vehicleOptions = useMemo(() => ['ALL', ...[...new Set(events.map(e => e.vehicle))]], [events]);
  const filteredEvents = useMemo(() => (
    vehicleFilter.includes('ALL') ? events : events.filter(e => vehicleFilter.includes(e.vehicle))
  ), [events, vehicleFilter]);

  const summary = useMemo(() => {
    const vehicles = new Set();
    let tight = 0;
    events.forEach(e => {
      vehicles.add(e.vehicle);
      if (e.tightGap) tight++;
    });
    return { count: events.length, vehicles: vehicles.size, tight };
  }, [events]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: isMobile ? 1 : 3 }}>
        <Typography variant="h5" gutterBottom>
          🚖 Ride & Vehicle Calendar — {date.format('dddd, MMMM D')}
        </Typography>

        <Stack direction={isMobile ? 'column' : 'row'} spacing={2} alignItems="center" mb={2}>
          <DatePicker
            value={date}
            onChange={(newDate) => setDate(dayjs(newDate))}
            slotProps={{ textField: { size: 'small' } }}
          />

          <Autocomplete
            multiple
            options={vehicleOptions}
            value={vehicleFilter}
            onChange={(e, newVal) => {
              if (newVal.includes('ALL') && newVal.length > 1) {
                newVal = newVal.filter(v => v !== 'ALL');
              }
              setVehicleFilter(newVal.length === 0 ? ['ALL'] : newVal);
            }}
            filterSelectedOptions
            disableCloseOnSelect
            getOptionLabel={(option) => option === 'ALL' ? 'All Vehicles' : option}
            renderOption={(props, option) => (
              <Box component="li" key={option} {...props} sx={{
                backgroundColor: option === 'ALL' ? undefined : getVehicleColor(option),
                color: option === 'ALL' ? undefined : '#fff',
                fontWeight: 500,
                '&:hover': {
                  backgroundColor: option === 'ALL' ? undefined : getVehicleColor(option),
                  opacity: 0.9
                }
              }}>{option === 'ALL' ? 'All Vehicles' : option}</Box>
            )}
            renderInput={(params) => (
              <TextField {...params} label="Filter Vehicles" size="small" />
            )}
            sx={{ minWidth: 260 }}
          />

          <Tooltip title="Toggle Compact Mode">
            <Stack direction="row" alignItems="center">
              <Typography fontSize={14}>Compact</Typography>
              <Switch size="small" checked={compactMode} onChange={() => setCompactMode(!compactMode)} />
            </Stack>
          </Tooltip>
        </Stack>

        <Typography fontSize={14} sx={{ mb: 1 }}>
          {summary.count} Rides • {summary.vehicles} Vehicles • {summary.tight} Tight Gaps
        </Typography>

        {loading ? (
          <Box display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : filteredEvents.length === 0 ? (
          <Typography>No rides scheduled for this date.</Typography>
        ) : (
          <Stack spacing={compactMode ? 1 : 2}>
            {filteredEvents.map((event, idx) => (
              <Box
                key={idx}
                onClick={() => { setSelectedEvent(event); setModalOpen(true); }}
                sx={{
                  p: compactMode ? 1.25 : 2,
                  borderRadius: 2,
                  cursor: 'pointer',
                  borderLeft: `6px solid ${getVehicleColor(event.vehicle)}`,
                  backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f8f8f8',
                  '&:hover': {
                    backgroundColor: theme.palette.mode === 'dark' ? '#2a2a2a' : '#f1f1f1',
                  },
                  position: 'relative'
                }}
              >
                <Typography fontWeight="bold" display="flex" alignItems="center">
                  <DirectionsCarIcon fontSize="small" sx={{ mr: 1 }} />
                  {event.title}
                </Typography>
                <Typography fontSize={14}>
                  {event.start.format('h:mm A')} – {event.end.format('h:mm A')}
                </Typography>
                <Chip
                  label={event.vehicle}
                  size="small"
                  sx={{
                    mt: 0.5,
                    backgroundColor: getVehicleColor(event.vehicle),
                    color: '#fff',
                    fontWeight: 500,
                    fontSize: '0.75rem'
                  }}
                />
              </Box>
            ))}
          </Stack>
        )}

        <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="sm">
          <Box p={3}>
            <Typography variant="h6" gutterBottom>{selectedEvent?.title}</Typography>
            <Typography variant="body2">
              {selectedEvent?.start.format('dddd, MMMM D')}<br />
              {selectedEvent?.start.format('h:mm A')} – {selectedEvent?.end.format('h:mm A')}
            </Typography>
            {selectedEvent?.tightGap && (
              <Chip label="Tight Gap to Previous Ride" color="error" sx={{ mt: 1 }} />
            )}
            {selectedEvent?.description && (
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>Details:</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedEvent.description.split('\n').map((line, i) => (
                    /^\(\d{3}\)\s*\d{3}-\d{4}$/.test(line.trim()) ? (
                      <a key={i} href={`tel:${line.replace(/\D/g, '')}`} style={{ color: '#4cbb17' }}>
                        {line}
                      </a>
                    ) : <span key={i}>{line}<br /></span>
                  ))}
                </Typography>
              </Box>
            )}
            <Box textAlign="right" mt={3}>
              <Button onClick={() => setModalOpen(false)} variant="outlined">Close</Button>
            </Box>
          </Box>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}
