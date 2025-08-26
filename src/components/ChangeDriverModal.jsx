/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Alert,
  Slide,
  CircularProgress,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

import { useDriver } from "../context/DriverContext.jsx";
import useAuthGuard from "../hooks/useAuthGuard";

import DriverSelect from "./DriverSelect";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

function roleColor(role) {
  const r = String(role || "").toLowerCase();
  if (r === "admin") return "success";
  if (r === "driver") return "primary";
  if (r === "dispatcher") return "secondary";
  return "default";
}

const ChangeDriverModal = ({ open, onClose }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const { driver, setDriver } = useDriver(); // driver = current effective driver object
  const [selected, setSelected] = useState(driver ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Optional auth gate for admins only
  useAuthGuard("admin");

  // Reset modal state on open/close or driver change
  useEffect(() => {
    if (open) {
      setSelected(driver ?? null);
      setIsSubmitting(false);
      setError("");
    }
  }, [open, driver]);

  const sameSelection = useMemo(() => {
    if (!driver || !selected) return false;
    return (driver.email || driver.id) === (selected.email || selected.id);
  }, [driver, selected]);

  const handleApply = useCallback(async () => {
    setError("");
    if (!selected) return;
    if (sameSelection) return; // nothing to do

    setIsSubmitting(true);
    try {
      await setDriver(selected);
      (onClose || (() => {}))();
    } catch (e) {
      // Surface a concise message but log details elsewhere if your logger exists
      setError(e?.message || "Failed to change driver. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [selected, sameSelection, setDriver, onClose]);

  // Prevent backdrop/ESC close while submitting to avoid state races
  const handleClose = useCallback(
    (_evt, reason) => {
      if (isSubmitting) return;
      if (reason === "backdropClick" || reason === "escapeKeyDown") {
        (onClose || (() => {}))();
        return;
      }
      (onClose || (() => {}))();
    },
    [isSubmitting, onClose]
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      TransitionComponent={Transition}
      keepMounted
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          backgroundColor: isDark ? "background.paper" : "background.default",
          color: "text.primary",
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 800 }}>🔁 Change Driver</DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <DriverSelect
          value={selected}
          onChange={setSelected}
          disabled={isSubmitting}
          label="Select Driver"
          autoFocus
          fullWidth
        />

        {selected && (
          <Box
            mt={2}
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gap={2}
          >
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {selected.name || selected.email || "Selected Driver"}
              </Typography>
              {selected.email && (
                <Typography variant="caption" color="text.secondary">
                  {selected.email}
                </Typography>
              )}
            </Box>
            <Chip
              label={String(selected.access || "user").toUpperCase()}
              color={roleColor(selected.access)}
              size="small"
              variant="filled"
            />
          </Box>
        )}

        {sameSelection && (
          <Alert severity="info" sx={{ mt: 2 }}>
            This is already the current driver.
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          disabled={!selected || sameSelection || isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
        >
          {isSubmitting ? "Applying…" : "Apply"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default React.memo(ChangeDriverModal);
