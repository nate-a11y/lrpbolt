import React from "react";
import { Box, Typography } from "@mui/material";
import BrandGradient from "./BrandGradient.jsx";
export default function BrandHeader({ title, right, mb = 2 }) {
  return (
    <Box sx={{ mb }}>
      <Box sx={(t) => ({
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", backgroundColor: t.palette.background.paper,
        borderRadius: t.shape.borderRadius, boxShadow: t.palette.mode === "dark" ? "0 0 0 1px rgba(232,234,237,0.06)" : "0 0 0 1px rgba(0,0,0,0.06)",
      })}>
        <Typography variant="h6" fontWeight={800}>{title}</Typography>
        <Box>{right}</Box>
      </Box>
      <BrandGradient glow height={5} />
    </Box>
  );
}
