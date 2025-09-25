import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";

export default function RideGroup({
  title,
  total,
  onSelectAll,
  children,
  allSelected = false,
}) {
  return (
    <Box
      component="section"
      sx={{
        borderRadius: (t) => t.shape.borderRadius,
        border: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: (t) => t.palette.background.paper,
        overflow: "visible",
        position: "relative",
      }}
    >
      <Box
        sx={{
          position: "sticky",
          top: {
            xs: "calc(56px + env(safe-area-inset-top, 0px))",
            sm: "64px",
          },
          zIndex: (t) => t.zIndex.appBar + 1,
          backdropFilter: "blur(6px)",
          backgroundColor: (t) =>
            t.palette.mode === "dark"
              ? t.palette.background.default
              : t.palette.background.paper,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
          rowGap: 0.75,
          py: 1,
          px: 1.5,
          borderBottom: (t) => `2px solid ${t.palette.primary.main}`,
        }}
      >
        <Stack spacing={0.25} sx={{ pr: 2, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {total} {total === 1 ? "ride" : "rides"}
          </Typography>
        </Stack>
        <Button
          size="small"
          variant="outlined"
          onClick={onSelectAll}
          sx={{
            borderRadius: 999,
            fontWeight: 700,
            px: 1.75,
            whiteSpace: "nowrap",
            ml: "auto",
            flexShrink: 0,
          }}
        >
          {allSelected ? "Clear" : "Select All"}
        </Button>
      </Box>
      <Stack spacing={1.5} sx={{ py: 1.5 }}>
        {children}
      </Stack>
    </Box>
  );
}
