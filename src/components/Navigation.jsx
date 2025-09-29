/* Proprietary and confidential. See LICENSE. */
import { useMemo, useState, useCallback, useEffect } from "react";
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Switch,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  Tooltip,
  Divider,
  Chip,
  Avatar,
  Menu,
  MenuItem,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { NavLink, useLocation } from "react-router-dom";
import MenuIcon from "@mui/icons-material/Menu";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LoopIcon from "@mui/icons-material/Loop";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import PersonIcon from "@mui/icons-material/Person";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import InfoIcon from "@mui/icons-material/Info";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import CropFreeIcon from "@mui/icons-material/CropFree";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import ContactEmergencyIcon from "@mui/icons-material/ContactEmergency";

import { useDriver } from "../context/DriverContext.jsx";
import useMenuAnchor from "../hooks/useMenuAnchor";
import { useColorMode } from "../context/ColorModeContext.jsx";
import useFcmEnable from "../hooks/useFcmEnable";

const DRAWER_WIDTH = 260;
const MINI_WIDTH = 72;

// Expanded (stripe) active style
const makeActiveExpandedSX = (theme) => {
  const c = theme.palette.success.main;
  return {
    borderLeft: `4px solid ${c}`,
    bgcolor:
      theme.palette.mode === "dark"
        ? "rgba(76,187,23,0.18)"
        : "rgba(76,187,23,0.12)",
    "& .MuiListItemIcon-root": { color: c },
    fontWeight: 700,
  };
};

// Collapsed (icon bubble) active style
const makeActiveCollapsedSX = (theme) => {
  const c = theme.palette.success.main;
  return {
    position: "relative",
    "& .MuiListItemIcon-root": { color: c },
    "&::after": {
      content: '""',
      position: "absolute",
      inset: 6,
      borderRadius: 12,
      backgroundColor:
        theme.palette.mode === "dark"
          ? "rgba(76,187,23,0.18)"
          : "rgba(76,187,23,0.12)",
      zIndex: -1,
    },
  };
};

const ALL_NAV_ITEMS = [
  { label: "Claim Rides", icon: <DirectionsCarIcon />, path: "/rides" },
  { label: "Time Clock", icon: <AccessTimeIcon />, path: "/clock" },
  { label: "Drop-Off Info", icon: <InfoIcon />, path: "/info" },
  {
    label: "Vehicle Tips",
    icon: <DirectionsCarIcon />,
    path: "/drop-guides",
    hidden: true,
  },
  {
    label: "Directory & Escalations",
    icon: <ContactEmergencyIcon />,
    path: "/directory",
  },
  {
    label: "Calendar & Availability",
    icon: <CalendarMonthIcon />,
    path: "/calendar",
  },
  { label: "Ticket Scanner", icon: <CropFreeIcon />, path: "/scan" },
  { label: "Tickets", icon: <ConfirmationNumberIcon />, path: "/tickets" },

  // Admin-only
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
];

export default function Navigation({ onChangeDriver, onSignOut }) {
  const { driver } = useDriver();
  const role = (driver?.access || "").toLowerCase();
  const isAdmin = role === "admin";
  const selectedDriver = driver?.name || "";
  const { mode, toggle } = useColorMode();
  const {
    enableFcm,
    supported: fcmSupported,
    token: fcmToken,
  } = useFcmEnable();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const location = useLocation();

  // Respect reduced motion for transitions
  const prefersNoMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  // Mobile temporary drawer open/close
  const [mobileOpen, setMobileOpen] = useState(false);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const userMenu = useMenuAnchor();

  // Desktop mini/expanded state (persisted)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const raw = localStorage.getItem("lrp:navCollapsed");
      return raw === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("lrp:navCollapsed", String(collapsed));
    } catch {
      /* ignore storage errors */
    }
  }, [collapsed]);

  // Optional UX boost: keyboard shortcut "[" to collapse, "]" to expand (desktop only)
  useEffect(() => {
    if (isMobile) return;
    const onKey = (e) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "[") setCollapsed(true);
      if (e.key === "]") setCollapsed(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile]);

  const items = useMemo(
    () => ALL_NAV_ITEMS.filter((it) => (!it.admin || isAdmin) && !it.hidden),
    [isAdmin],
  );

  // Determine label of currently active route
  const activeLabel = useMemo(
    () => items.find((it) => location.pathname.startsWith(it.path))?.label,
    [items, location.pathname],
  );

  const activeSXExpanded = useMemo(() => makeActiveExpandedSX(theme), [theme]);
  const activeSXCollapsed = useMemo(
    () => makeActiveCollapsedSX(theme),
    [theme],
  );

  const isActivePath = useCallback(
    (to) => location.pathname === to || location.pathname.startsWith(`${to}/`),
    [location.pathname],
  );

  // Drawer width depends on mode
  const effectiveDrawerWidth = isMobile
    ? 0
    : collapsed
      ? MINI_WIDTH
      : DRAWER_WIDTH;

  const DrawerHeader = (
    <Box
      sx={{
        ...theme.mixins.toolbar,
        px: collapsed ? 1 : 2,
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        gap: 1,
        transition: prefersNoMotion ? "none" : "padding 200ms ease",
      }}
    >
      {!collapsed ? (
        <>
          <Box display="flex" alignItems="center" gap={1}>
            <img
              src="https://lakeridepros.xyz/Color%20logo%20-%20no%20background.png"
              alt="Lake Ride Pros"
              style={{ height: 32 }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <Typography variant="subtitle1" fontWeight={800} noWrap>
              LRP Driver Portal
            </Typography>
          </Box>
          <Tooltip title="Collapse">
            <IconButton
              onClick={() => setCollapsed(true)}
              size="small"
              aria-label="Collapse navigation"
            >
              <ChevronLeftIcon />
            </IconButton>
          </Tooltip>
        </>
      ) : (
        <Tooltip title="Expand">
          <IconButton
            onClick={() => setCollapsed(false)}
            size="small"
            aria-label="Expand navigation"
          >
            <ChevronRightIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );

  const DrawerList = (
    <Box
      sx={{
        width: collapsed ? MINI_WIDTH : DRAWER_WIDTH,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflowX: "hidden",
        transition: prefersNoMotion ? "none" : "width 200ms ease",
      }}
      role="presentation"
      onClick={() => {
        // Mobile temporary drawer should close after a click
        if (isMobile) setMobileOpen(false);
      }}
      onKeyDown={(e) => {
        if (isMobile && (e.key === "Escape" || e.key === "Enter"))
          setMobileOpen(false);
      }}
    >
      {DrawerHeader}
      <Divider />

      {/* Nav items */}
      <List sx={{ py: 0 }}>
        {items.map((item) => {
          const active = isActivePath(item.path);
          const button = (
            <ListItemButton
              key={item.path}
              component={NavLink}
              to={item.path}
              sx={{
                borderLeft: "4px solid transparent",
                "&:hover": { bgcolor: "action.hover" },
                px: collapsed ? 1 : 2,
                justifyContent: collapsed ? "center" : "flex-start",
                transition: prefersNoMotion ? "none" : "padding 200ms ease",
                ...(active
                  ? collapsed
                    ? activeSXCollapsed
                    : activeSXExpanded
                  : null),
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: collapsed ? "auto" : 40,
                  mr: collapsed ? 0 : 1,
                  justifyContent: "center",
                }}
              >
                {item.icon}
              </ListItemIcon>
              {!collapsed && <ListItemText primary={item.label} />}
            </ListItemButton>
          );

          return collapsed ? (
            <Tooltip key={item.path} title={item.label} placement="right">
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
      </List>

      <Divider sx={{ my: 1 }} />

      {/* Footer controls */}
      <Box sx={{ mt: "auto" }}>
        <List sx={{ py: 0 }}>
          <ListItemButton
            disableRipple
            disabled
            sx={{
              px: collapsed ? 1 : 2,
              justifyContent: collapsed ? "center" : "flex-start",
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: collapsed ? "auto" : 40,
                mr: collapsed ? 0 : 1,
                justifyContent: "center",
              }}
            >
              <PersonIcon />
            </ListItemIcon>
            {!collapsed ? (
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1} minWidth={0}>
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ maxWidth: 160 }}
                      title={selectedDriver || "—"}
                    >
                      Driver: {selectedDriver || "—"}
                    </Typography>
                    {role && (
                      <Chip
                        size="small"
                        label={isAdmin ? "Admin" : role}
                        color={isAdmin ? "success" : "default"}
                        sx={{ height: 22 }}
                      />
                    )}
                  </Box>
                }
              />
            ) : (
              <Tooltip
                title={`Driver: ${selectedDriver || "—"}`}
                placement="right"
              >
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    fontSize: 14,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    mx: "auto",
                  }}
                  aria-label="Driver initials"
                >
                  {(selectedDriver || "—").slice(0, 1).toUpperCase()}
                </Avatar>
              </Tooltip>
            )}
          </ListItemButton>

          <ListItemButton
            onClick={(e) => e.stopPropagation()}
            sx={{
              px: collapsed ? 1 : 2,
              justifyContent: collapsed ? "center" : "flex-start",
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: collapsed ? "auto" : 40,
                mr: collapsed ? 0 : 1,
                justifyContent: "center",
              }}
            >
              <Brightness4Icon />
            </ListItemIcon>
            {!collapsed && <ListItemText primary="Dark Mode" />}
            <Switch
              edge="end"
              checked={mode === "dark"}
              onChange={toggle}
              inputProps={{ "aria-label": "Toggle dark mode" }}
              sx={{ ml: collapsed ? 0 : 1 }}
            />
          </ListItemButton>

          {isAdmin && (
            <ListItemButton
              onClick={(e) => {
                e.stopPropagation();
                if (onChangeDriver) onChangeDriver();
              }}
              sx={{
                px: collapsed ? 1 : 2,
                justifyContent: collapsed ? "center" : "flex-start",
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: collapsed ? "auto" : 40,
                  mr: collapsed ? 0 : 1,
                  justifyContent: "center",
                  color: "success.main",
                }}
              >
                <LoopIcon />
              </ListItemIcon>
              {!collapsed && <ListItemText primary="Change Driver" />}
            </ListItemButton>
          )}

          <ListItemButton
            onClick={onSignOut}
            sx={{
              px: collapsed ? 1 : 2,
              justifyContent: collapsed ? "center" : "flex-start",
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: collapsed ? "auto" : 40,
                mr: collapsed ? 0 : 1,
                justifyContent: "center",
              }}
            >
              <ExitToAppIcon color="error" />
            </ListItemIcon>
            {!collapsed && <ListItemText primary="Sign Out" />}
          </ListItemButton>
        </List>

        {!collapsed && (
          <Box sx={{ p: 2, pt: 0, opacity: 0.7 }}>
            <Typography variant="caption">
              © {new Date().getFullYear()} Lake Ride Pros
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <>
      {/* AppBar */}
      <AppBar
        position="sticky"
        color="default"
        enableColorOnDark
        elevation={1}
        sx={{
          width: { sm: `calc(100% - ${effectiveDrawerWidth}px)` },
          ml: { sm: `${effectiveDrawerWidth}px` },
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
          bgcolor: (t) =>
            t.palette.mode === "dark"
              ? t.palette.background.default
              : t.palette.background.paper,
          transition: prefersNoMotion
            ? "none"
            : "margin-left 200ms ease, width 200ms ease",
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", gap: 2 }}>
          <Box
            display="flex"
            alignItems="center"
            gap={1.5}
            minWidth={0}
            flexGrow={1}
          >
            {isMobile ? (
              <Tooltip title="Menu">
                <IconButton
                  edge="start"
                  onClick={openMobile}
                  size="large"
                  aria-label="Open menu"
                >
                  <MenuIcon />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title={collapsed ? "Expand" : "Collapse"}>
                <IconButton
                  edge="start"
                  onClick={() => setCollapsed((v) => !v)}
                  size="large"
                  aria-label={
                    collapsed ? "Expand navigation" : "Collapse navigation"
                  }
                >
                  {collapsed ? <MenuOpenIcon /> : <MenuIcon />}
                </IconButton>
              </Tooltip>
            )}

            {!isMobile && !collapsed && (
              <img
                src="https://lakeridepros.xyz/Color%20logo%20-%20no%20background.png"
                alt="Lake Ride Pros"
                style={{ height: 40 }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}

            <Typography
              variant={isMobile ? "subtitle1" : "h6"}
              fontWeight={800}
              noWrap
              sx={{ lineHeight: 1.1 }}
            >
              {isMobile
                ? activeLabel || "LRP Driver Portal"
                : "Lake Ride Pros: Driver Portal"}
            </Typography>
          </Box>

          {/* Right cluster */}
          <Box display="flex" alignItems="center" gap={2} flexShrink={0}>
            {!isMobile && (
              <>
                <Tooltip title="Toggle Dark Mode">
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <Brightness4Icon fontSize="small" />
                    <Switch
                      checked={mode === "dark"}
                      onChange={toggle}
                      inputProps={{ "aria-label": "Toggle dark mode" }}
                    />
                  </Box>
                </Tooltip>

                <Typography
                  variant="body2"
                  noWrap
                  maxWidth={240}
                  title={selectedDriver || "—"}
                >
                  <strong>Driver:</strong> {selectedDriver || "—"}
                </Typography>

                {isAdmin && (
                  <Tooltip title="Change Driver">
                    <IconButton
                      onClick={onChangeDriver}
                      sx={{ color: "success.main" }}
                      aria-label="Change driver"
                    >
                      <LoopIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </>
            )}

            {fcmSupported && !fcmToken && (
              <Tooltip title="Enable Notifications">
                <IconButton
                  onClick={enableFcm}
                  size="small"
                  sx={{ flexShrink: 0 }}
                  aria-label="Enable notifications"
                >
                  <NotificationsActiveOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            <IconButton
              id="user-menu-btn"
              onClick={userMenu.handleOpen}
              size="small"
            >
              <PersonIcon />
            </IconButton>
            <Menu
              open={userMenu.open}
              anchorEl={userMenu.anchorEl}
              onClose={userMenu.handleClose}
              MenuListProps={{
                onClick: userMenu.handleClose,
                "aria-labelledby": "user-menu-btn",
              }}
            >
              <MenuItem onClick={onSignOut}>Sign Out</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Desktop: permanent mini/permanent drawer */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          open
          sx={{
            width: effectiveDrawerWidth,
            flexShrink: 0,
            whiteSpace: "nowrap",
            "& .MuiDrawer-paper": {
              width: effectiveDrawerWidth,
              boxSizing: "border-box",
              borderRight: (t) => `1px solid ${t.palette.divider}`,
              overflowX: "hidden",
              transition: prefersNoMotion ? "none" : "width 200ms ease",
              display: "flex",
              flexDirection: "column",
            },
          }}
        >
          {DrawerList}
        </Drawer>
      )}

      {/* Mobile: temporary drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={closeMobile}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              borderRight: (t) => `1px solid ${t.palette.divider}`,
            },
          }}
        >
          {DrawerList}
        </Drawer>
      )}
    </>
  );
}
