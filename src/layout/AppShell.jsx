import { useState, useCallback } from "react";
import { Box, IconButton, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";

import Header from "../components/Header";
import MainNav from "../components/MainNav";

import { APP_BAR_HEIGHT } from "./constants";

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
          px: { xs: 2, md: 3 }, // consistent horizontal padding
          pb: 3, // bottom padding
          backgroundColor: (t) => t.palette.background.default,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
