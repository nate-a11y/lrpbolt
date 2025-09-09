import React from "react";
import { Box, Stack, Typography, Button } from "@mui/material";

export default function RideGroup({ title, total, onSelectAll, children }) {
  return (
    <Box
      sx={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 18,
        p: 2,
        mb: 2.5,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
      >
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          {title}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            Total: {total}
          </Typography>
          <Button size="small" variant="outlined" onClick={onSelectAll}>
            Select All
          </Button>
        </Stack>
      </Stack>
      <Stack spacing={1.5}>{children}</Stack>
    </Box>
  );
}
