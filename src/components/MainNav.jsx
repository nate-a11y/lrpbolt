import { useMemo, memo, useCallback } from "react";
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
  Tooltip,
  IconButton,
} from "@mui/material";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { NAV_ITEMS } from "../config/nav";
import { DRAWER_WIDTH, APP_BAR_HEIGHT } from "../layout/constants";
import { iconMap } from "../utils/iconMap";
import { useAuth } from "../context/AuthContext.jsx";
import { useDriver } from "../context/DriverContext.jsx";
import { useColorMode } from "../context/ColorModeContext.jsx";
import { canSeeNav } from "../utils/roleGuards";

const APP_VERSION = import.meta.env.VITE_APP_VERSION;
const QUICK_LINK_IDS = new Set(["admin-user-manager", "admin-notifications"]);

function MainNav({
  variant = "permanent",
  open = true,
  onClose,
  onChangeDriver,
}) {
  const { user, role } = useAuth();
  const { driverName, logout: signOut } = useDriver?.() || {};
  const { mode, toggle } = useColorMode();
  const location = useLocation();
  const navigate = useNavigate();
  const items = useMemo(
    () => NAV_ITEMS.filter((it) => !it.hidden && canSeeNav(it.id, role)),
    [role],
  );

  const { primaryItems, quickLinkItems } = useMemo(() => {
    const primary = [];
    const quick = [];
    items.forEach((item) => {
      if (QUICK_LINK_IDS.has(item.id)) {
        quick.push(item);
      } else {
        primary.push(item);
      }
    });
    return { primaryItems: primary, quickLinkItems: quick };
  }, [items]);

  const drawerSx = {
    width: DRAWER_WIDTH,
    flexShrink: 0,
    [`& .MuiDrawer-paper`]: {
      width: DRAWER_WIDTH,
      boxSizing: "border-box",
      top: APP_BAR_HEIGHT,
      height: `calc(100% - ${APP_BAR_HEIGHT}px)`,
      borderRight: "none",
      backgroundColor: (t) => t.palette.background.paper,
      // Avoid subpixel blur on the hairline
      willChange: "transform",
      transform: "translateZ(0)",
    },
  };

  const DrawerProps =
    variant === "temporary" ? { ModalProps: { keepMounted: true } } : {};

  const handleItemClick = () => {
    if (variant === "temporary" && onClose) onClose();
  };

  const SettingsIcon = iconMap.Settings || iconMap.ChevronRight;
  const ExitIcon = iconMap.ExitToApp || iconMap.ChevronRight;
  const versionLabel = APP_VERSION ? `v${APP_VERSION}` : "vdev";

  const handleNavigate = useCallback(
    (to) => {
      navigate(to);
      if (variant === "temporary" && onClose) onClose();
    },
    [navigate, onClose, variant],
  );

  const handleSettingsClick = useCallback(() => {
    handleNavigate("/settings");
  }, [handleNavigate]);

  const handleQuickLinkClick = useCallback(
    (to) => {
      handleNavigate(to);
    },
    [handleNavigate],
  );

  const handleSignOut = useCallback(() => {
    if (variant === "temporary" && onClose) onClose();
    if (signOut) signOut();
  }, [onClose, signOut, variant]);

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <List sx={{ py: 1 }}>
        {primaryItems.map(({ id, to, label, icon }) => {
          const Icon = iconMap[icon] || iconMap.ChevronRight;
          const selected = location.pathname === to;
          return (
            <ListItemButton
              key={id}
              component={NavLink}
              to={to}
              onClick={handleItemClick}
              selected={selected}
              sx={{
                "&.active, &.Mui-selected": {
                  bgcolor: (t) => t.palette.action.selected,
                },
              }}
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
      <Box
        sx={{
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Driver:
            </Typography>
            <Chip
              size="small"
              label={driverName || user?.displayName || "Unknown"}
            />
            {role === "admin" && (
              <Chip size="small" color="success" label="Admin" />
            )}
          </Stack>

          {/* Driver Switcher (restored) */}
          <Button variant="outlined" size="small" onClick={onChangeDriver}>
            Change Driver
          </Button>
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          rowGap={1}
        >
          <Typography variant="body2">Dark Mode</Typography>
          <Switch checked={mode === "dark"} onChange={toggle} />
        </Stack>

        <Typography
          variant="caption"
          sx={{
            color: (t) =>
              t.palette.mode === "dark"
                ? "rgba(255,255,255,0.5)"
                : t.palette.text.secondary,
          }}
        >
          Version: {versionLabel}
        </Typography>

        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          flexWrap="wrap"
          rowGap={1}
        >
          <Tooltip title="Settings">
            <IconButton
              size="small"
              color="inherit"
              onClick={handleSettingsClick}
              aria-label="Settings"
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {quickLinkItems.map(({ id, to, label, icon }) => {
            const Icon = iconMap[icon] || iconMap.ChevronRight;
            const active = location.pathname.startsWith(to);
            return (
              <Tooltip title={label} key={id}>
                <IconButton
                  size="small"
                  color={active ? "primary" : "inherit"}
                  onClick={() => handleQuickLinkClick(to)}
                  aria-label={label}
                  sx={{
                    bgcolor: active
                      ? (t) => t.palette.action.selected
                      : undefined,
                    "&:hover": {
                      bgcolor: (t) => t.palette.action.hover,
                    },
                  }}
                >
                  <Icon fontSize="small" />
                </IconButton>
              </Tooltip>
            );
          })}
          <Tooltip title="Sign Out">
            <IconButton
              size="small"
              color="error"
              onClick={handleSignOut}
              aria-label="Sign out"
            >
              <ExitIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={variant}
      open={open}
      onClose={onClose}
      sx={drawerSx}
      {...DrawerProps}
    >
      {drawerContent}
    </Drawer>
  );
}

export default memo(MainNav);
