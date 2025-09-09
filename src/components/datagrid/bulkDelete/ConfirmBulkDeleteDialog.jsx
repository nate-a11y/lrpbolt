import * as React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";

export default function ConfirmBulkDeleteDialog({
  open,
  onClose,
  onConfirm,
  total,
  sampleRows = [],
  deleting = false,
}) {
  return (
    <Dialog
      open={open}
      onClose={deleting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Confirm Delete</DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ mb: 1 }}>
          You are about to delete <b>{total}</b>{" "}
          {total === 1 ? "item" : "items"}. This action cannot be undone (unless
          you click Undo in the snackbar right after).
        </Typography>
        {sampleRows.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>
              Preview of first few rows:
            </Typography>
            <List dense>
              {sampleRows.slice(0, 5).map((r, idx) => (
                <ListItem key={idx} disableGutters>
                  <ListItemText
                    primary={r?.id ?? "(no id)"}
                    secondary={
                      r?.summaryText ??
                      r?.title ??
                      r?.name ??
                      r?.driverName ??
                      ""
                    }
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={deleting}
          color="error"
          variant="contained"
        >
          {deleting ? "Deleting…" : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
