import React from "react";
import { AppBar, Toolbar, Box, IconButton, Typography, Chip, Stack, Tooltip } from "@mui/material";
import DarkModeIcon from "@mui/icons-material/Brightness4";
import LightModeIcon from "@mui/icons-material/LightMode";
import RefreshIcon from "@mui/icons-material/Loop";
import AccountCircleIcon from "@mui/icons-material/Person";
import { APP_BAR_HEIGHT } from "../layout/constants";
import { useAuth } from "../context/AuthContext.jsx"; // must expose { user }
import { useDriver } from "../context/DriverContext.jsx"; // must expose { driverName, role }
import { useColorMode } from "../context/ColorModeContext.jsx";

export default function Header({ onRefresh, leftSlot = null }) {
  const { user } = useAuth?.() || {};
  const { driverName, role } = useDriver?.() || {};
  const { mode, toggle } = useColorMode();

  return (
    <AppBar position="fixed" elevation={0} color="transparent" sx={{
      backdropFilter: "saturate(180%) blur(8px)",
      borderBottom: (t) => `1px solid ${t.palette.divider}`,
      height: APP_BAR_HEIGHT,
      justifyContent: "center",
    }}>
      <Toolbar disableGutters variant="dense" sx={{ px: { xs: 2, md: 3 }, minHeight: APP_BAR_HEIGHT }}>
        {leftSlot}
        {/* Brand */}
        <Typography variant="h6" sx={{ fontWeight: 800, mr: 2 }}>
          LRP Driver Portal
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        {/* Actions (dark mode, refresh, user) */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}>
            <IconButton onClick={toggle}>
              {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh"><IconButton onClick={onRefresh}><RefreshIcon /></IconButton></Tooltip>

          <Chip
            size="small"
            label={driverName || user?.displayName || "Driver"}
            icon={<AccountCircleIcon />}
            sx={{ fontWeight: 600 }}
          />
          {role?.toLowerCase?.() === "admin" && (
            <Chip size="small" color="success" label="Admin" sx={{ fontWeight: 700 }} />
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
