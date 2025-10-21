import React from "react";
import { Button, Paper, Stack, Typography } from "@mui/material";

import LoadingButtonLite from "@/components/inputs/LoadingButtonLite.jsx";

export default function BatchClaimBar({
  count,
  onClear,
  onClaimAll,
  loading,
  disabled = false,
}) {
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
        border: (t) => `1px solid ${t.palette.divider}`,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography fontWeight={700}>{count} selected</Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClear} variant="text">
            Clear
          </Button>
          <LoadingButtonLite
            onClick={onClaimAll}
            variant="contained"
            loading={loading}
            disabled={disabled}
            loadingText="Claiming…"
          >
            Claim Selected
          </LoadingButtonLite>
        </Stack>
      </Stack>
    </Paper>
  );
}
