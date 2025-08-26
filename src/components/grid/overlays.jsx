import * as React from "react";
import { Box, CircularProgress, Typography } from "@mui/material";

export function LoadingOverlay() {
  return (
    <Box sx={{ p: 3, textAlign: "center" }}>
      <CircularProgress size={28} />
      <Typography variant="body2" sx={{ mt: 1 }}>
        Loading…
      </Typography>
    </Box>
  );
}
export function NoRowsOverlay() {
  return (
    <Box sx={{ p: 3, textAlign: "center" }}>
      <Typography variant="body2">No rows</Typography>
    </Box>
  );
}
export function NoResultsOverlay() {
  return (
    <Box sx={{ p: 3, textAlign: "center" }}>
      <Typography variant="body2">No matches</Typography>
    </Box>
  );
}
export function ErrorOverlay({ message = "Something went wrong" }) {
  return (
    <Box sx={{ p: 3, textAlign: "center" }}>
      <Typography variant="body2">{message}</Typography>
    </Box>
  );
}
