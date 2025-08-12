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
      <Header onRefresh={onRefresh} leftSlot={!mdUp ? (<IconButton edge="start" onClick={toggleMobile} sx={{ mr: 1 }}><MenuIcon/></IconButton>) : null} />
      <MainNav variant={mdUp ? "permanent" : "temporary"} open={!mdUp ? mobileOpen : true} onClose={closeMobile} onChangeDriver={onChangeDriver} />
      <Box
        component="main"
        sx={{
          flex: 1,
          pt: `calc(${APP_BAR_HEIGHT}px + 6px)`,        // nothing hides under blur
          ml: { xs: 0, sm: `var(--rail-width)` },   // space for rail
          pr: { xs: 1.5, sm: 2 },                   // keep RIGHT padding
          pl: { xs: 1.5, sm: 2 },                   // remove LEFT padding
          pb: 3,                                     // keep bottom padding
          backgroundColor: (t) => t.palette.background.default,
          borderLeft: (t) => `1px solid ${t.palette.divider}`, // single hairline (drawer has none)
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
