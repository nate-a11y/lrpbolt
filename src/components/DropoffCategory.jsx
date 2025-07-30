/* Proprietary and confidential. See LICENSE. */
import React from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DropoffLocation from './DropoffLocation';

export default function DropoffCategory({ title, locations, onSelect }) {
  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography fontWeight="bold">{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        {locations.map((loc) => (
          <DropoffLocation
            key={loc.name}
            {...loc}
            onSelect={() => onSelect(loc)}
          />
        ))}
      </AccordionDetails>
    </Accordion>
  );
}
