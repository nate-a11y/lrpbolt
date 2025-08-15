/* Proprietary and confidential. See LICENSE. */
import React, { useMemo, useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, TextField, FormControlLabel, Switch, Typography
} from "@mui/material";

export default function DropoffDialog({ open, onClose, onSubmit }) {
  const [isDropoff, setIsDropoff] = useState(true);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [chargePercent, setChargePercent] = useState("");
  const [needsWash, setNeedsWash] = useState(false);
  const [needsInterior, setNeedsInterior] = useState(false);
  const [issues, setIssues] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset every time the dialog opens
  useEffect(() => {
    if (open) {
      setIsDropoff(true);
      setVehicleNumber("");
      setChargePercent("");
      setNeedsWash(false);
      setNeedsInterior(false);
      setIssues("");
      setSubmitting(false);
    }
  }, [open]);

  const canSubmit = useMemo(
    () => !isDropoff || (vehicleNumber.trim().length > 0 && chargePercent.trim().length > 0),
    [isDropoff, vehicleNumber, chargePercent]
  );

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({
        isDropoff,
        vehicleNumber: vehicleNumber.trim(),
        chargePercent: chargePercent.trim(),
        needsWash,
        needsInterior,
        issues: issues.trim(),
      });
      setIsDropoff(true);
      setVehicleNumber("");
      setChargePercent("");
      setNeedsWash(false);
      setNeedsInterior(false);
      setIssues("");
      onClose(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    setIsDropoff(true);
    setVehicleNumber("");
    setChargePercent("");
    setNeedsWash(false);
    setNeedsInterior(false);
    setIssues("");
    onClose(false);
  }

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : handleCancel}
      fullWidth
      maxWidth="sm"
      keepMounted={false}
    >
      <DialogTitle>Was the vehicle dropped off?</DialogTitle>
      <DialogContent>
        <Stack gap={2} mt={1}>
          <FormControlLabel
            control={<Switch checked={isDropoff} onChange={(e) => setIsDropoff(e.target.checked)} />}
            label={isDropoff ? "Yes, dropped off" : "No, not dropped off"}
          />

          {isDropoff && (
            <>
              <TextField
                label="Vehicle Number"
                placeholder="02"
                inputProps={{ inputMode: "numeric", maxLength: 2 }}
                value={vehicleNumber}
                onChange={(e) =>
                  setVehicleNumber(e.target.value.replace(/\D/g, "").slice(0, 2))
                }
                required
                fullWidth
              />
              <TextField
                label="Charge %"
                placeholder="87"
                inputProps={{ inputMode: "numeric", maxLength: 3 }}
                value={chargePercent}
                onChange={(e) =>
                  setChargePercent(e.target.value.replace(/\D/g, "").slice(0, 3))
                }
                required
                fullWidth
              />
              <FormControlLabel
                control={<Switch checked={needsWash} onChange={(e) => setNeedsWash(e.target.checked)} />}
                label={`Needs Car Wash? ${needsWash ? "Yes" : "No"}`}
              />
              <FormControlLabel
                control={<Switch checked={needsInterior} onChange={(e) => setNeedsInterior(e.target.checked)} />}
                label={`Needs Interior Clean? ${needsInterior ? "Yes" : "No"}`}
              />
              <TextField
                label="Issues"
                placeholder='e.g., "Left blinker not working"'
                value={issues}
                onChange={(e) => setIssues(e.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                SMS will include: “Reply STOP to opt out, HELP for help.”
              </Typography>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} disabled={submitting}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={!canSubmit || submitting} variant="contained">
          {isDropoff ? "Save & Send Text" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

