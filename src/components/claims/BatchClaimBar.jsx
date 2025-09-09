import React from "react";
import { Paper, Stack, Typography, Button } from "@mui/material";

export default function BatchClaimBar({ count, onClear, onClaimAll, loading }) {
  if (!count) return null;
  return (
    <Paper
      elevation={6}
      sx={{
        position: "sticky",
        bottom: 12,
        left: 0,
        right: 0,
        mx: "auto",
        maxWidth: 1100,
        p: 1.5,
        borderRadius: 14,
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography fontWeight={700}>{count} selected</Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClear} variant="text">
            Clear
          </Button>
          <Button onClick={onClaimAll} variant="contained" disabled={loading}>
            {loading ? "Claiming…" : "Claim Selected"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
