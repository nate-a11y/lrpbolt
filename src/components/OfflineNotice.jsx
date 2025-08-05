import React from "react";
import { Snackbar, Alert, Button } from "@mui/material";

export default function OfflineNotice({ open, onRetry, onClose }) {
  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
    >
      <Alert
        severity="warning"
        action={
          <>
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
            <Button color="inherit" size="small" onClick={onClose}>
              Dismiss
            </Button>
          </>
        }
      >
        You are offline. Some features may be unavailable.
      </Alert>
    </Snackbar>
  );
}
