import React from "react";
import { Box, Button, Typography } from "@mui/material";

export default function EmptyState({ onClear }) {
  return (
    <Box sx={{ textAlign: "center", py: 6 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        No contacts found
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.8, mb: 2 }}>
        Try a different search or clear the current filter.
      </Typography>
      {onClear ? (
        <Button variant="outlined" onClick={onClear}>
          Clear search
        </Button>
      ) : null}
    </Box>
  );
}
