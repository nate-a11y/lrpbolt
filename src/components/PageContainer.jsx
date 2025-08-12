import React from "react";
import { Box } from "@mui/material";
export default function PageContainer({ children, maxWidth = 1180, ...rest }) {
  return (
    <Box {...rest} sx={(t) => ({ maxWidth, mx: "auto", p: { xs: 2, sm: 3 }, bgcolor: t.palette.background.default, minHeight: "100vh" })}>
      {children}
    </Box>
  );
}

