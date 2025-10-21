import { useState, useCallback } from "react";
import { Box, IconButton, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";

import Header from "../components/Header";
import MainNav from "../components/MainNav";

export default function AppShell({ children, onRefresh, onChangeDriver }) {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

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
          // The body already reserves --appbar-h via CssBaseline. Keep a small gap for content.
          pt: "calc(var(--lrp-safe-top, 0px) + 6px)",
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
