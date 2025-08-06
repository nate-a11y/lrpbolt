/* Proprietary and confidential. See LICENSE. */
import React, { useState } from "react";
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  useTheme,
  useMediaQuery,
  Divider,
  Toolbar,
} from "@mui/material";
import { NavLink } from "react-router-dom";

import MenuIcon from "@mui/icons-material/Menu";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import InfoIcon from "@mui/icons-material/Info";
import PeopleIcon from "@mui/icons-material/People";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CropFreeIcon from "@mui/icons-material/CropFree";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import AppShortcutIcon from "@mui/icons-material/AppShortcut";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import WarningIcon from "@mui/icons-material/Warning";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import AirportShuttleIcon from "@mui/icons-material/AirportShuttle";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import { useDriver } from "../context/DriverContext.jsx";

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
    label: "User Manager",
    icon: <ManageAccountsIcon />,
    path: "/admin-user-manager",
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

export default function SidebarNavigation() {
  const { driver } = useDriver();
  const role = driver?.access || "";
  const isAdmin = role === "admin";
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const drawerContent = (
    <Box role="presentation">
      <Toolbar sx={{ minHeight: 64 }} />
      <Divider />
      <List>
        {NAV_ITEMS.map((item) => {
          if (item.admin && !isAdmin) return null;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {({ isActive }) => (
                <ListItemButton
                  selected={isActive}
                  sx={{
                    ...(isActive && {
                      borderLeft: "4px solid #4cbb17",
                      backgroundColor: theme.palette.action.selected,
                    }),
                  }}
                  onClick={() => isMobile && setMobileOpen(false)}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              )}
            </NavLink>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Drawer
      variant={isMobile ? "temporary" : "permanent"}
      open={isMobile ? mobileOpen : true}
      onClose={() => setMobileOpen(false)}
      ModalProps={{
        keepMounted: true,
      }}
      sx={{
        width: 240,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: 240,
          boxSizing: "border-box",
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
