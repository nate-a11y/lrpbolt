import { useState, useCallback, useEffect } from "react";
import { Box, IconButton, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";

import Header from "../components/Header";
import MainNav from "../components/MainNav";

import {
  APP_BAR_HEIGHT,
  DRAWER_WIDTH_COLLAPSED,
  DRAWER_WIDTH,
} from "./constants";

export default function AppShell({ children, onRefresh, onChangeDriver }) {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Track collapsed state for desktop
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try {
      const raw = localStorage.getItem("lrp:navCollapsed");
      return raw === "true";
    } catch {
      return false;
    }
  });

  // Update CSS variable for rail width
  useEffect(() => {
    const width = mdUp
      ? navCollapsed
        ? DRAWER_WIDTH_COLLAPSED
        : DRAWER_WIDTH
      : 0;
    document.documentElement.style.setProperty("--rail-width", `${width}px`);
  }, [mdUp, navCollapsed]);

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        minWidth: 0,
        overflowX: "auto",
        bgcolor: (t) => t.palette.background.default,
      }}
    >
      <Header
        onRefresh={onRefresh}
        leftSlot={
          !mdUp ? (
            <IconButton edge="start" onClick={toggleMobile} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          ) : null
        }
      />
      <MainNav
        variant={mdUp ? "permanent" : "temporary"}
        open={!mdUp ? mobileOpen : true}
        onClose={closeMobile}
        onChangeDriver={onChangeDriver}
        collapsed={mdUp ? navCollapsed : false}
        onCollapsedChange={setNavCollapsed}
      />
      <Box
        component="main"
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100%",
          minWidth: 0,
          maxWidth: "100%",
          overflowX: "hidden",
          pt: `${APP_BAR_HEIGHT}px`, // align with header height
          ml: { xs: 0, md: `var(--rail-width)` }, // space for rail when permanent
          pr: { xs: 0, md: 2 }, // horizontal padding when rail visible
          pl: { xs: 0, md: 2 }, // horizontal padding when rail visible
          pb: 3, // keep bottom padding
          backgroundColor: (t) => t.palette.background.default,
          borderLeft: (t) => `1px solid ${t.palette.divider}`, // single hairline (drawer has none)
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
