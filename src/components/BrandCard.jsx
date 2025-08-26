import React from "react";
import { Card, CardContent } from "@mui/material";

import BrandGradient from "./BrandGradient.jsx";
export default function BrandCard({ children, gradientPosition = "top", glow = true, contentSx, ...cardProps }) {
  return (
    <Card elevation={3} {...cardProps} sx={(t) => ({ backgroundColor: t.palette.background.paper, borderRadius: t.shape.borderRadius, ...(cardProps.sx || {}) })}>
      {gradientPosition === "top" && <BrandGradient glow={glow} />}
      <CardContent sx={contentSx}>{children}</CardContent>
      {gradientPosition === "bottom" && <BrandGradient position="bottom" glow={glow} />}
    </Card>
  );
}
