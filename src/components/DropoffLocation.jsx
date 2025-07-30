/* Proprietary and confidential. See LICENSE. */
import React from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Link
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';

export default function DropoffLocation({ name, notes, mapUrl, onSelect }) {
  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
          <DirectionsCarIcon fontSize="small" sx={{ mr: 1 }} />
          {name}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2" sx={{ mb: 1 }} color="text.secondary">
          {notes}
        </Typography>
        <Link
          component="button"
          underline="hover"
          onClick={onSelect}
          sx={{ fontSize: '0.875rem' }}
        >
          View Map / Drop-off Image
        </Link>
      </AccordionDetails>
    </Accordion>
  );
}
