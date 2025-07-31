import React from 'react';
import { Chip, Tooltip } from '@mui/material';

const COLOR_MAP = {
  suburban: 'default',
  suv: 'primary',
  sprinter: 'info',
  'rescue squad': 'warning',
  'limo bus': 'secondary',
  shuttle: 'success'
};

export default React.memo(function VehicleChip({ vehicle }) {
  const color = COLOR_MAP[vehicle.toLowerCase()] || 'default';
  return (
    <Tooltip title={vehicle}>
      <Chip label={vehicle} size="small" color={color} sx={{ mb: 0.5 }} />
    </Tooltip>
  );
});
