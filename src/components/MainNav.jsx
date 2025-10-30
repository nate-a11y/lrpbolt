import { useMemo, memo, useCallback, useState, useEffect } from "react";
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
  alpha,
} from "@mui/material";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PersonIcon from "@mui/icons-material/Person";
import Brightness4Icon from "@mui/icons-material/Brightness4";

import { NAV_ITEMS } from "../config/nav";
import {
  DRAWER_WIDTH,
  DRAWER_WIDTH_COLLAPSED,
  APP_BAR_HEIGHT,
} from "../layout/constants";
import { iconMap } from "../utils/iconMap";
import { useAuth } from "../context/AuthContext.jsx";
import { useDriver } from "../context/DriverContext.jsx";
import { useColorMode } from "../context/ColorModeContext.jsx";
import { canSeeNav } from "../utils/roleGuards";
import { getAppVersion } from "../utils/appVersion.js";

import VersionInline from "./VersionInline.jsx";

const APP_VERSION = getAppVersion();
const QUICK_LINK_IDS = new Set(["admin-user-manager", "admin-notifications"]);

function MainNav({
  variant = "permanent",
  open = true,
  onClose,
  onChangeDriver,
  collapsed: externalCollapsed,
  onCollapsedChange,
}) {
  const { user, role } = useAuth();
  const { driverName, logout: signOut } = useDriver?.() || {};
  const { mode, toggle } = useColorMode();
  const location = useLocation();
  const navigate = useNavigate();

  // Internal collapsed state with localStorage persistence
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    if (variant === "temporary") return false;
    try {
      const raw = localStorage.getItem("lrp:navCollapsed");
      return raw === "true";
    } catch {
      return false;
    }
  });

  // Use external collapsed prop if provided, otherwise use internal state
  const collapsed =
    externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;

  // Persist to localStorage when collapsed changes
  useEffect(() => {
    if (variant === "temporary") return;
    try {
      localStorage.setItem("lrp:navCollapsed", String(collapsed));
    } catch {
      /* ignore storage errors */
    }
  }, [collapsed, variant]);

  // Handle collapse toggle
  const handleToggleCollapsed = useCallback(() => {
    const newValue = !collapsed;
    if (onCollapsedChange) {
      onCollapsedChange(newValue);
    } else {
      setInternalCollapsed(newValue);
    }
  }, [collapsed, onCollapsedChange]);

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

  const effectiveWidth =
    variant === "temporary"
      ? DRAWER_WIDTH
      : collapsed
        ? DRAWER_WIDTH_COLLAPSED
        : DRAWER_WIDTH;

  const drawerSx = {
    width: effectiveWidth,
    flexShrink: 0,
    [`& .MuiDrawer-paper`]: {
      width: effectiveWidth,
      boxSizing: "border-box",
      top: APP_BAR_HEIGHT,
      height: `calc(100% - ${APP_BAR_HEIGHT}px)`,
      borderRight: "none",
      backgroundColor: (t) => t.palette.background.paper,
      // Avoid subpixel blur on the hairline
      willChange: "transform",
      transform: "translateZ(0)",
      transition: "width 200ms ease",
      overflowX: "hidden",
    },
  };

  const DrawerProps =
    variant === "temporary" ? { ModalProps: { keepMounted: true } } : {};

  const handleItemClick = () => {
    if (variant === "temporary" && onClose) onClose();
  };

  const SettingsIcon = iconMap.Settings || iconMap.ChevronRight;
  const ExitIcon = iconMap.ExitToApp || iconMap.ChevronRight;
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
      {/* Collapse/Expand button - only show on desktop permanent variant */}
      {variant === "permanent" && (
        <Box
          sx={{
            display: "flex",
            justifyContent: collapsed ? "center" : "flex-end",
            p: 1,
          }}
        >
          <Tooltip
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            <IconButton
              onClick={handleToggleCollapsed}
              size="small"
              aria-label={
                collapsed ? "Expand navigation" : "Collapse navigation"
              }
            >
              {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      )}
      <List sx={{ py: 1 }}>
        {primaryItems.map(({ id, to, label, icon, iconColor }) => {
          const Icon = iconMap[icon] || iconMap.ChevronRight;
          const selected = location.pathname === to;
          const resolvedIconColor = iconColor || null;
          const iconSx = resolvedIconColor
            ? { color: resolvedIconColor }
            : undefined;
          const button = (
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
                px: collapsed ? 1 : 2,
                justifyContent: collapsed ? "center" : "flex-start",
              }}
              end
            >
              <ListItemIcon
                sx={{
                  color: resolvedIconColor || "inherit",
                  minWidth: collapsed ? "auto" : 40,
                  mr: collapsed ? 0 : 1,
                  justifyContent: "center",
                }}
              >
                <Icon sx={iconSx} />
              </ListItemIcon>
              {!collapsed && <ListItemText primary={label} />}
            </ListItemButton>
          );
          return collapsed ? (
            <Tooltip key={id} title={label} placement="right">
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <Divider />
      <Box
        sx={{
          p: collapsed ? 1 : 2,
          display: "flex",
          flexDirection: "column",
          gap: collapsed ? 1 : 2,
        }}
      >
        {!collapsed ? (
          <>
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

              {/* Driver Switcher */}
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

            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: (t) =>
                    t.palette.mode === "dark"
                      ? alpha(t.palette.common.white, 0.5)
                      : t.palette.text.secondary,
                }}
              >
                Version
              </Typography>
              <VersionInline
                value={APP_VERSION}
                sx={{
                  color: (t) =>
                    t.palette.mode === "dark"
                      ? alpha(t.palette.common.white, 0.72)
                      : t.palette.text.secondary,
                }}
              />
            </Box>
          </>
        ) : (
          <>
            {/* Collapsed view - show icons only */}
            <Tooltip
              title={`Driver: ${driverName || user?.displayName || "Unknown"}`}
              placement="right"
            >
              <IconButton size="small" disabled>
                <PersonIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={`Dark Mode ${mode === "dark" ? "On" : "Off"}`}
              placement="right"
            >
              <IconButton size="small" onClick={toggle}>
                <Brightness4Icon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}

        <Stack
          direction={collapsed ? "column" : "row"}
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
              <Tooltip title={label} key={id} placement="right">
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
