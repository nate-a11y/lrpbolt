import React from "react";
import { Drawer, List, ListItemButton, ListItemIcon, ListItemText, Box, Divider, Switch, Stack, Typography, Chip } from "@mui/material";
import * as Icons from "@mui/icons-material";
import { NAV_ITEMS } from "../config/nav";
import { DRAWER_WIDTH, APP_BAR_HEIGHT } from "../layout/constants";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useDriver } from "../context/DriverContext.jsx";

export default function MainNav({ onToggleTheme }) {
  const { user } = useAuth?.() || {};
  const { driverName, role, logout: signOut } = useDriver?.() || {};
  const items = NAV_ITEMS.filter((it) => !it.admin || role?.toLowerCase?.() === "admin");

  return (
    <Drawer variant="permanent" sx={{
      width: DRAWER_WIDTH,
      flexShrink: 0,
      [`& .MuiDrawer-paper`]: {
        width: DRAWER_WIDTH,
        boxSizing: "border-box",
        top: APP_BAR_HEIGHT,
        height: `calc(100% - ${APP_BAR_HEIGHT}px)`,
        borderRight: (t) => `1px solid ${t.palette.divider}`,
      },
    }}>
      <List sx={{ py: 1 }}>
        {items.map(({ to, label, icon }) => {
          const Icon = Icons[icon] || Icons["ChevronRight"];
          return (
            <ListItemButton key={to} component={NavLink} to={to} sx={{
              "&.active": { bgcolor: (t) => t.palette.action.selected },
            }}>
              <ListItemIcon><Icon /></ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      {/* Footer info: driver + admin + theme + sign out */}
      <Divider />
      <Box sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ fontWeight: 700 }}>Driver:</Typography>
            <Chip size="small" label={driverName || user?.displayName || "Unknown"} />
            {role?.toLowerCase?.() === "admin" && <Chip size="small" color="success" label="Admin" />}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2">Dark Mode</Typography>
            <Switch onChange={onToggleTheme} />
          </Stack>
          <ListItemButton onClick={signOut}>
            <ListItemIcon><Icons["ExitToApp"] /></ListItemIcon>
            <ListItemText primary="Sign Out" />
          </ListItemButton>
        </Stack>
      </Box>
    </Drawer>
  );
}
