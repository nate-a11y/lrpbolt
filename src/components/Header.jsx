import {
  AppBar,
  Toolbar,
  Box,
  IconButton,
  Typography,
  Chip,
  Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Loop";
import AccountCircleIcon from "@mui/icons-material/Person";

import { APP_BAR_HEIGHT } from "../layout/constants";
import { useAuth } from "../context/AuthContext.jsx";
import { useDriver } from "../context/DriverContext.jsx";

import ThemeToggle from "./ThemeToggle.jsx";

export default function Header({ onRefresh, leftSlot = null }) {
  const { user } = useAuth?.() || {};
  const { driverName, role } = useDriver?.() || {};
  return (
    <AppBar
      position="fixed"
      elevation={0}
      color="transparent"
      sx={(t) => ({
        backdropFilter: "saturate(180%) blur(8px)",
        WebkitBackdropFilter: "saturate(180%) blur(8px)",
        backgroundColor:
          t.palette.mode === "dark"
            ? alpha(t.palette.background.paper, 0.9)
            : alpha(t.palette.background.paper, 0.85),
        borderBottom: `1px solid ${t.palette.divider}`,
        height: APP_BAR_HEIGHT,
        justifyContent: "center",
        zIndex: t.zIndex.drawer + 1,
      })}
    >
      <Toolbar
        disableGutters
        variant="dense"
        sx={{ px: { xs: 2, md: 3 }, minHeight: APP_BAR_HEIGHT }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {leftSlot}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mr: 2 }}>
            <Box
              component="a"
              href="/"
              sx={{ display: "inline-flex", lineHeight: 0 }}
            >
              <Box
                component="img"
                src="/Color%20logo%20with%20background.svg"
                alt="LRP"
                sx={{ width: 30, height: 30, borderRadius: 1 }}
                draggable={false}
              />
            </Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                fontSize: { xs: "0.875rem", sm: "1rem", md: "1.25rem" },
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: { xs: "120px", sm: "200px", md: "none" },
              }}
            >
              LRP Driver Portal
            </Typography>
          </Box>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <ThemeToggle />
        <Tooltip title="Refresh">
          <IconButton onClick={onRefresh}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Chip
          size="small"
          label={driverName || user?.displayName || "Driver"}
          icon={<AccountCircleIcon />}
          sx={{ fontWeight: 600 }}
        />
      </Toolbar>
    </AppBar>
  );
}
