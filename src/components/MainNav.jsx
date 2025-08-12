import React from "react";
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Divider,
  Switch,
  Stack,
  Typography,
  Chip,
  Button,
} from "@mui/material";
import { NAV_ITEMS } from "../config/nav";
import { DRAWER_WIDTH, APP_BAR_HEIGHT } from "../layout/constants";
import { NavLink, useLocation } from "react-router-dom";
import { iconMap } from "../utils/iconMap";
import { useAuth } from "../context/AuthContext.jsx";
import { useDriver } from "../context/DriverContext.jsx";
import { useColorMode } from "../context/ColorModeContext.jsx";

export default function MainNav({ variant = "permanent", open = true, onClose, onChangeDriver }) {
  const { user } = useAuth?.() || {};
  const { driverName, role, logout: signOut } = useDriver?.() || {};
  const { mode, toggle } = useColorMode();
  const location = useLocation();
  const items = NAV_ITEMS.filter((it) => !it.admin || role?.toLowerCase?.() === "admin");

  const drawerSx = {
    width: DRAWER_WIDTH,
    flexShrink: 0,
    [`& .MuiDrawer-paper`]: {
      width: DRAWER_WIDTH,
      boxSizing: "border-box",
      top: APP_BAR_HEIGHT,
      height: `calc(100% - ${APP_BAR_HEIGHT}px)`,
      borderRight: (t) => `1px solid ${t.palette.divider}`, // hairline
      backgroundColor: (t) => t.palette.background.paper,
      // Avoid subpixel blur on the hairline
      willChange: "transform",
      transform: "translateZ(0)",
    },
  };

  const DrawerProps = variant === "temporary" ? { ModalProps: { keepMounted: true } } : {};

  const handleItemClick = () => {
    if (variant === "temporary" && onClose) onClose();
  };

  const ExitIcon = iconMap.ExitToApp || iconMap.ChevronRight;

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <List sx={{ py: 1 }}>
        {items.map(({ to, label, icon }) => {
          const Icon = iconMap[icon] || iconMap.ChevronRight;
          const selected = location.pathname === to;
          return (
            <ListItemButton
              key={to}
              component={NavLink}
              to={to}
              onClick={handleItemClick}
              selected={selected}
              sx={{ "&.active, &.Mui-selected": { bgcolor: (t) => t.palette.action.selected } }}
              end
            >
              <ListItemIcon>
                <Icon />
              </ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <Divider />
      <Box sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Driver:
            </Typography>
            <Chip size="small" label={driverName || user?.displayName || "Unknown"} />
            {role?.toLowerCase?.() === "admin" && (
              <Chip size="small" color="success" label="Admin" />
            )}
          </Stack>

          {/* Driver Switcher (restored) */}
          <Button variant="outlined" size="small" onClick={onChangeDriver}>
            Change Driver
          </Button>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2">Dark Mode</Typography>
            <Switch checked={mode === "dark"} onChange={toggle} />
          </Stack>

          <ListItemButton onClick={signOut}>
            <ListItemIcon>
              <ExitIcon />
            </ListItemIcon>
            <ListItemText primary="Sign Out" />
          </ListItemButton>
        </Stack>
      </Box>
    </Box>
  );

  return (
    <Drawer variant={variant} open={open} onClose={onClose} sx={drawerSx} {...DrawerProps}>
      {drawerContent}
    </Drawer>
  );
}
