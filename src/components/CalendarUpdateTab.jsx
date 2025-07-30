/* Proprietary and confidential. See LICENSE. */
import React from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export default function CalendarUpdateTab() {
  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, pt: 2, pb: 4 }}>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        🗓️ How to Mark Yourself Unavailable
      </Typography>

      <Typography variant="body1" sx={{ mb: 3 }}>
        Keeping your availability current is critical to avoid overbooking.
        Please follow both steps below for Google Calendar and Moovs.
      </Typography>

      <Divider sx={{ mb: 3 }} />

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">🗓️ Step 1: Google Calendar</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" gutterBottom>
            Use Google Calendar to show you're unavailable to dispatch and managers:
          </Typography>
          <Box component="ul" sx={{ pl: 3, mb: 0 }}>
            <li><strong>Create</strong> → <strong>Event</strong></li>
            <li>Title: <em>Your Name – Not Available</em></li>
            <li>Select date(s) & time or mark <strong>All Day</strong></li>
            <li>Use <strong>Repeat</strong> if recurring</li>
            <li>Click <strong>Save</strong></li>
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">🚫 Step 2: Block Time in Moovs</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" gutterBottom>
            Block your vehicle inside Moovs to avoid customer bookings:
          </Typography>
          <Box component="ul" sx={{ pl: 3, mb: 0 }}>
            <li>Go to <strong>Reservations</strong> → Click <strong>Create</strong></li>
            <li>Booking Contact: <strong>HOUSE ACCOUNT</strong></li>
            <li>Order Type: <strong>Corporate</strong></li>
            <li>Trip Type: <strong>Hourly</strong></li>
            <li>Pickup/Dropoff: <em>Lake Ozark, MO</em></li>
            <li>Add your vehicle → Click <strong>Add Vehicle</strong></li>
            <li>Leave <strong>Base Rate</strong> blank</li>
            <li>Delete the 3 service fee lines</li>
            <li>Click <strong>Save Reservation</strong></li>
            <li>Mark status as <strong>DONE</strong></li>
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="bold">✨ Bonus: Duplicate Days Off</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" gutterBottom>
            Going on vacation? Duplicate your reservation for up to 10 dates at once:
          </Typography>
          <Box component="ul" sx={{ pl: 3 }}>
            <li>Open reservation → Click 3-dot menu</li>
            <li>Select <strong>Duplicate</strong></li>
            <li>Select up to 10 dates</li>
            <li>Click <strong>Confirm</strong> to finish</li>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
