import React from "react";
import { Snackbar, Alert } from "@mui/material";

export default function ErrorBanner({ error, onClose }) {
  return (
    <Snackbar
      open={Boolean(error)}
      onClose={onClose}
      autoHideDuration={6000}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert severity="error" onClose={onClose} sx={{ width: "100%" }}>
        {error === "permission-denied"
          ? "You don’t have permission to view this data."
          : error}
      </Alert>
    </Snackbar>
  );
}
