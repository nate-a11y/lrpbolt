/* Proprietary and confidential. See LICENSE. */
import React from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Alert
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import BlockIcon from '@mui/icons-material/Block';
import StarIcon from '@mui/icons-material/Star';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useTheme } from '@mui/material/styles';

export default function CalendarUpdateTab() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, pt: 2, pb: 4, maxWidth: 700, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        🗓️ How to Mark Yourself Unavailable
      </Typography>

      <Typography variant="body1" sx={{ mb: 2 }}>
        Keeping your availability current is critical to avoid overbooking.
        Please follow both steps below for Google Calendar and Moovs.
      </Typography>

      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 3 }}>
        <strong>Quick Tip:</strong> Update both Google Calendar and Moovs so dispatch knows when you&apos;re out.
      </Alert>

      <Divider sx={{ mb: 3 }} />

      <Accordion defaultExpanded sx={{ mb: 2, bgcolor: isDark ? '#1d1d1d' : '#fafafa', borderLeft: '5px solid #4cbb17' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarMonthIcon fontSize="small" /> Step 1: Google Calendar
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" gutterBottom>
            Use Google Calendar to show you&apos;re unavailable to dispatch and managers:
          </Typography>
          <Box component="ul" sx={{ pl: 3, mb: 0 }}>
            <li><strong>🖊️ Create Event</strong></li>
            <li>Title: <em>Your Name – Not Available</em></li>
            <li><strong>Select date(s)</strong> & time or mark <strong>All Day</strong></li>
            <li>Use <strong>🔁 Repeat</strong> if recurring</li>
            <li><strong>💾 Save</strong></li>
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={{ mb: 2, bgcolor: isDark ? '#1d1d1d' : '#fafafa', borderLeft: '5px solid #4cbb17' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BlockIcon fontSize="small" /> Step 2: Block Time in Moovs
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" gutterBottom>
            Block your vehicle inside Moovs to avoid customer bookings:
          </Typography>
          <Box component="ul" sx={{ pl: 3, mb: 0 }}>
            <li>Go to <strong>Reservations</strong> → <strong>🖊️ Create</strong></li>
            <li>Booking Contact: <strong>HOUSE ACCOUNT</strong></li>
            <li>Order Type: <strong>Corporate</strong></li>
            <li>Trip Type: <strong>Hourly</strong></li>
            <li>Pickup/Dropoff: <em>Lake Ozark, MO</em></li>
            <li>Add your vehicle → Click <strong>Add Vehicle</strong></li>
            <li>Leave <strong>Base Rate</strong> blank</li>
            <li>Delete the 3 service fee lines</li>
            <li><strong>💾 Save Reservation</strong></li>
            <li>Mark status as <strong>DONE</strong></li>
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={{ bgcolor: isDark ? '#1d1d1d' : '#fafafa', borderLeft: '5px solid #4cbb17' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StarIcon fontSize="small" /> Bonus: Duplicate Days Off
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" gutterBottom>
            Going on vacation? Duplicate your reservation for up to 10 dates at once:
          </Typography>
          <Box component="ul" sx={{ pl: 3 }}>
            <li>Open reservation → Click 3-dot menu</li>
            <li>Select <strong>Duplicate</strong></li>
            <li>Select up to 10 dates</li>
            <li><strong>💾 Confirm</strong> to finish</li>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
