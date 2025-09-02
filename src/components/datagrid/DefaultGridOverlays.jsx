import React from "react";
import PropTypes from "prop-types";
import { GridOverlay } from "@mui/x-data-grid-pro";
import { Stack, Typography } from "@mui/material";

export function NoRowsOverlay() {
  return (
    <GridOverlay>
      <Stack
        height="100%"
        alignItems="center"
        justifyContent="center"
        sx={{ p: 2 }}
      >
        <Typography variant="body2">No rows to display</Typography>
      </Stack>
    </GridOverlay>
  );
}

export function ErrorOverlay({ error }) {
  return (
    <GridOverlay>
      <Stack
        height="100%"
        alignItems="center"
        justifyContent="center"
        sx={{ p: 2 }}
      >
        <Typography color="error" variant="body2">
          {error?.message || "An error occurred"}
        </Typography>
      </Stack>
    </GridOverlay>
  );
}

ErrorOverlay.propTypes = {
  error: PropTypes.any,
};

export default { NoRowsOverlay, ErrorOverlay };
