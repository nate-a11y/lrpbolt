import React, { useState, useCallback } from "react";
import { Box, IconButton, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import Header from "../components/Header";
import MainNav from "../components/MainNav";
import { APP_BAR_HEIGHT, DRAWER_WIDTH } from "./constants";

export default function AppShell({ children, onToggleTheme, onRefresh, onChangeDriver }) {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: (t) => t.palette.background.default }}>
      <Header
        onToggleTheme={onToggleTheme}
        onRefresh={onRefresh}
        leftSlot={!mdUp ? (
          <IconButton edge="start" onClick={toggleMobile} sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
        ) : null}
      />
      {/* Drawer(s) */}
      <MainNav
        variant={mdUp ? "permanent" : "temporary"}
        open={!mdUp ? mobileOpen : true}
        onClose={closeMobile}
        onToggleTheme={onToggleTheme}
        onChangeDriver={onChangeDriver}
      />
      {/* Main content area */}
      <Box
        component="main"
        sx={{
          flex: 1,
          pt: `${APP_BAR_HEIGHT}px`,
          ml: mdUp ? `${DRAWER_WIDTH}px` : 0,
          px: { xs: 2, md: 3 },
          pb: 4,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
