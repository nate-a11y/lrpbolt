import React from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  useTheme,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';

const DriverSelector = ({ driver, setDriver, drivers = [], isTracking, role }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isAdmin = role === 'Admin';

  const handleChange = (e) => {
    if (!isTracking && isAdmin) {
      const selected = e.target.value;
      setDriver(selected);
      localStorage.setItem('lrp_driver', selected);
    }
  };

  const handleClear = () => {
    if (!isTracking && isAdmin) {
      setDriver('');
      localStorage.removeItem('lrp_driver');
    }
  };

  const sortedDrivers = [...drivers].sort((a, b) => a.localeCompare(b));

  return (
    <Box
      display="flex"
      flexDirection={{ xs: 'column', sm: 'row' }}
      alignItems="center"
      justifyContent="flex-start"
      gap={2}
      flexWrap="wrap"
      sx={{
        p: 2,
        backgroundColor: isDark ? 'grey.900' : 'grey.100',
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`
      }}
    >
      <Typography variant="body1" fontWeight="bold">
        Driver: <span style={{ fontWeight: 600 }}>{driver || '—'}</span>
      </Typography>

      {isAdmin ? (
        <>
          <Button
            onClick={handleClear}
            disabled={isTracking}
            variant="outlined"
            size="small"
          >
            🔁 Change Driver
          </Button>

          <FormControl fullWidth sx={{ minWidth: 240 }}>
            <InputLabel>Select Driver</InputLabel>
            <Select
              value={driver}
              onChange={handleChange}
              label="Select Driver"
              disabled={isTracking}
              sx={{
                bgcolor: isDark ? 'grey.800' : 'background.paper',
                borderRadius: 1,
              }}
            >
              {sortedDrivers.map((name, i) => (
                <MenuItem key={i} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </>
      ) : (
        <Chip
          icon={<LockIcon fontSize="small" />}
          label="Locked"
          size="small"
          sx={{
            backgroundColor: isDark ? '#555' : '#888',
            color: '#fff'
          }}
        />
      )}
    </Box>
  );
};

export default React.memo(DriverSelector);
