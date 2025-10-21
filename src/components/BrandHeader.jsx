import React, { useEffect } from "react";
import { AppBar, Toolbar, Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

export default function BrandHeader() {
  const theme = useTheme();
  const upSm = useMediaQuery(theme.breakpoints.up("sm"));
  // Compute the dense toolbar height we use
  const headerHeight = upSm ? 64 : 56;

  // Expose the height globally so CssBaseline can pad content
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--appbar-h",
      `${headerHeight}px`,
    );
  }, [headerHeight]);

  return (
    <AppBar
      elevation={0}
      color="default"
      position="fixed"
      sx={{
        bgcolor: (t) => t.palette.background.paper,
        borderBottom: (t) => `1px solid ${t.palette.divider}`,
        zIndex: (t) => t.zIndex.drawer + 1,
      }}
    >
      <Toolbar variant="dense" sx={{ minHeight: headerHeight }}>
        {/* left: menu + logo */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {/* ... existing left controls ... */}
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* right controls */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {/* ... existing right controls ... */}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
