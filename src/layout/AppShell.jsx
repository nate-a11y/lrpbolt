import React, { useState, useCallback } from "react";
import { Box, IconButton, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import Header from "../components/Header";
import MainNav from "../components/MainNav";
import { APP_BAR_HEIGHT, DRAWER_WIDTH } from "./constants";

export default function AppShell({ children, onRefresh, onChangeDriver }) {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: (t) => t.palette.background.default }}>
      <Header
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
        onChangeDriver={onChangeDriver}
      />
      {/* Main content area */}
      <Box
        component="main"
        sx={{
          flex: 1,
          pt: `${APP_BAR_HEIGHT}px`,
          ml: mdUp ? `${DRAWER_WIDTH}px` : 0,
          // tight but breathable next to the 1px drawer hairline
          pl: { xs: 1, md: 1.5 },
          pr: { xs: 2, md: 3 },
          pb: 4,
          // ensure no background seam shines through on scroll
          backgroundColor: (t) => t.palette.background.default,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
