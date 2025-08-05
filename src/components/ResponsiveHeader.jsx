/* Proprietary and confidential. See LICENSE. */
import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Switch,
  Button,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  Tooltip,
  Divider,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { NavLink } from "react-router-dom";

import MenuIcon from "@mui/icons-material/Menu";
import LoopIcon from "@mui/icons-material/Loop";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import PersonIcon from "@mui/icons-material/Person";

import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AirportShuttleIcon from "@mui/icons-material/AirportShuttle";
import InfoIcon from "@mui/icons-material/Info";
import PeopleIcon from "@mui/icons-material/People";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import WarningIcon from "@mui/icons-material/Warning";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import AppShortcutIcon from "@mui/icons-material/AppShortcut";
import CropFreeIcon from "@mui/icons-material/CropFree";

const NAV_ITEMS = [
  { label: "Claim Rides", icon: <DirectionsCarIcon />, path: "/rides" },
  { label: "Time Clock", icon: <AccessTimeIcon />, path: "/clock" },
  {
    label: "Shootout Ride & Time Tracker",
    icon: <AirportShuttleIcon />,
    path: "/shootout",
  },
  { label: "Drop-Off Info", icon: <InfoIcon />, path: "/info" },
  { label: "Vehicle Tips", icon: <DirectionsCarIcon />, path: "/drop-guides" },
  { label: "Driver Directory", icon: <PeopleIcon />, path: "/directory" },
  { label: "Calendar / Moovs", icon: <CalendarMonthIcon />, path: "/calendar" },
  { label: "Escalation Guide", icon: <WarningIcon />, path: "/escalation" },
  {
    label: "Ride & Vehicle Calendar",
    icon: <EventAvailableIcon />,
    path: "/vehicle-calendar",
  },
  { label: "Ticket Scanner", icon: <CropFreeIcon />, path: "/scan" },
  { label: "Tickets", icon: <ConfirmationNumberIcon />, path: "/tickets" },
  {
    label: "Admin Logs",
    icon: <AdminPanelSettingsIcon />,
    path: "/admin-time-log",
    admin: true,
  },
  {
    label: "Add Ride",
    icon: <AddCircleOutlineIcon />,
    path: "/ride-entry",
    admin: true,
  },
  {
    label: "Generate Ticket",
    icon: <AppShortcutIcon />,
    path: "/generate-ticket",
    admin: true,
  },
];

const isActiveStyle = {
  borderLeft: "4px solid #4cbb17",
  backgroundColor: "rgba(76, 187, 23, 0.1)",
};

const ResponsiveHeader = ({
  darkMode,
  setDarkMode,
  selectedDriver,
  role,
  onChangeDriver,
  onSignOut,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <AppBar
        position="fixed"
        color="default"
        elevation={1}
        sx={{
          width: { sm: "calc(100% - 240px)" },
          ml: { sm: "240px" },
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Box display="flex" alignItems="center">
            {isMobile && (
              <IconButton
                edge="start"
                onClick={() => setDrawerOpen(true)}
                size="large"
              >
                <MenuIcon />
              </IconButton>
            )}
            <img
              src="https://lakeridepros.xyz/Color%20logo%20-%20no%20background.png"
              alt="Lake Ride Pros"
              style={{ height: 40, marginRight: 8 }}
            />
            <Typography
              variant={isMobile ? "subtitle1" : "h6"}
              fontWeight="bold"
              sx={{ whiteSpace: "nowrap" }}
            >
              Lake Ride Pros: Driver Portal
            </Typography>
          </Box>

          {!isMobile && (
            <Box display="flex" alignItems="center" gap={2}>
              <Tooltip title="Toggle Dark Mode">
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Brightness4Icon fontSize="small" />
                  <Switch
                    checked={darkMode}
                    onChange={() => setDarkMode(!darkMode)}
                  />
                </Box>
              </Tooltip>
              <Typography variant="body2">
                <strong>Driver:</strong> {selectedDriver}
              </Typography>
              {role === "Admin" && (
                <Tooltip title="Change Driver">
                  <IconButton
                    onClick={onChangeDriver}
                    sx={{ color: "success.main" }}
                  >
                    <LoopIcon />
                  </IconButton>
                </Tooltip>
              )}
              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={onSignOut}
              >
                Sign Out
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        >
          <Box
            sx={{ width: 250 }}
            role="presentation"
            onClick={() => setDrawerOpen(false)}
          >
            <List>
              {NAV_ITEMS.map((item) =>
                item.admin && role !== "Admin" ? null : (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    {({ isActive }) => (
                      <ListItemButton
                        selected={isActive}
                        sx={isActive ? isActiveStyle : {}}
                      >
                        <ListItemIcon>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.label} />
                      </ListItemButton>
                    )}
                  </NavLink>
                ),
              )}
              <Divider sx={{ my: 1 }} />
              <ListItemButton disabled>
                <ListItemIcon>
                  <PersonIcon />
                </ListItemIcon>
                <ListItemText primary={`Driver: ${selectedDriver}`} />
              </ListItemButton>
              <ListItemButton>
                <ListItemIcon>
                  <Brightness4Icon />
                </ListItemIcon>
                <Switch
                  checked={darkMode}
                  onChange={() => setDarkMode(!darkMode)}
                  size="small"
                />
                <ListItemText primary="Dark Mode" sx={{ ml: 1 }} />
              </ListItemButton>
              {role === "Admin" && (
                <ListItemButton onClick={onChangeDriver}>
                  <ListItemIcon>
                    <LoopIcon />
                  </ListItemIcon>
                  <ListItemText primary="Change Driver" />
                </ListItemButton>
              )}
              <ListItemButton onClick={onSignOut}>
                <ListItemIcon>
                  <ExitToAppIcon color="error" />
                </ListItemIcon>
                <ListItemText primary="Sign Out" />
              </ListItemButton>
            </List>
          </Box>
        </Drawer>
      )}
    </>
  );
};

export default ResponsiveHeader;
