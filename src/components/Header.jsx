import React from "react";
import { AppBar, Toolbar, Box, IconButton, Typography, Chip, Tooltip } from "@mui/material";
import DarkModeIcon from "@mui/icons-material/Brightness4";
import LightModeIcon from "@mui/icons-material/LightMode";
import RefreshIcon from "@mui/icons-material/Loop";
import AccountCircleIcon from "@mui/icons-material/Person";
import { APP_BAR_HEIGHT } from "../layout/constants";
import { useAuth } from "../context/AuthContext.jsx";
import { useDriver } from "../context/DriverContext.jsx";
import { useColorMode } from "../context/ColorModeContext.jsx";

export default function Header({ onRefresh, leftSlot = null }) {
  const { user } = useAuth?.() || {};
  const { driverName, role } = useDriver?.() || {};
  const { mode, toggle } = useColorMode();

  return (
    <AppBar position="fixed" elevation={0} color="transparent" sx={(t) => ({
      backdropFilter: "saturate(180%) blur(8px)",
      WebkitBackdropFilter: "saturate(180%) blur(8px)",
      backgroundColor: t.palette.background.paper,
      borderBottom: `1px solid ${t.palette.divider}`,
      height: APP_BAR_HEIGHT,
      justifyContent: "center",
      zIndex: t.zIndex.drawer + 1,
    })}>
      <Toolbar disableGutters variant="dense" sx={{ px:{ xs:2, md:3 }, minHeight: APP_BAR_HEIGHT }}>
        {leftSlot}
        <Typography variant="h6" sx={{ fontWeight: 800, mr: 2 }}>LRP Driver Portal</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}>
          <IconButton onClick={toggle}>{mode === "dark" ? <LightModeIcon/> : <DarkModeIcon/>}</IconButton>
        </Tooltip>
        <Tooltip title="Refresh"><IconButton onClick={onRefresh}><RefreshIcon /></IconButton></Tooltip>
        <Chip size="small" label={driverName || user?.displayName || "Driver"} icon={<AccountCircleIcon />} sx={{ fontWeight: 600 }}/>
        {role?.toLowerCase?.() === "admin" && <Chip size="small" color="success" label="Admin" sx={{ fontWeight: 700 }} />}
      </Toolbar>
    </AppBar>
  );
}
