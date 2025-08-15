/* Proprietary and confidential. See LICENSE. */
import React, { useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, TextField, FormControlLabel, Switch, Typography
} from "@mui/material";

export default function DropoffDialog({ open, onClose, onSubmit }) {
  const [isDropoff, setIsDropoff] = useState(true);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [needsWash, setNeedsWash] = useState(false);
  const [needsInterior, setNeedsInterior] = useState(false);
  const [issues, setIssues] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => !isDropoff || vehicleNumber.trim().length > 0, [isDropoff, vehicleNumber]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({
        isDropoff,
        vehicleNumber: vehicleNumber.trim(),
        needsWash,
        needsInterior,
        issues: issues.trim(),
      });
      onClose(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={() => !submitting && onClose(false)} fullWidth maxWidth="sm">
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
                onChange={(e) => setVehicleNumber(e.target.value.replace(/\D/g, "").slice(0, 2))}
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
        <Button onClick={() => onClose(false)} disabled={submitting}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={!canSubmit || submitting} variant="contained">
          {isDropoff ? "Save & Send Text" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

