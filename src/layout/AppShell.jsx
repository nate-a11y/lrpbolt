import React from "react";
import { Box } from "@mui/material";
import Header from "../components/Header";
import MainNav from "../components/MainNav";
import { APP_BAR_HEIGHT, DRAWER_WIDTH } from "./constants";

export default function AppShell({ children, onToggleTheme, onRefresh }) {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: (t) => t.palette.background.default }}>
      <Header onToggleTheme={onToggleTheme} onRefresh={onRefresh} />
      <MainNav onToggleTheme={onToggleTheme} />
      <Box
        component="main"
        sx={{
          flex: 1,
          pt: `${APP_BAR_HEIGHT}px`,
          ml: `${DRAWER_WIDTH}px`,
          px: { xs: 2, md: 3 },
          pb: 4,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
