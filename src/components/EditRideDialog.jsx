/* Proprietary and confidential. See LICENSE. */
import React, { useMemo, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField } from "@mui/material";
import { LocalizationProvider, DateTimePicker } from "@mui/x-date-pickers-pro";
import { AdapterDayjs } from "@mui/x-date-pickers-pro/AdapterDayjs";
import dayjs from "../utils/dates";           // your extended dayjs with tz
import { isValidDayjs } from "../utils/dates";
import { patchRide } from "../services/rides";
import useAuth from "../hooks/useAuth";

export default function EditRideDialog({ open, onClose, collectionName, ride }) {
  const { user } = useAuth();

  const initialPickup = useMemo(() => {
    const v = ride?.pickupTime;
    if (!v) return null;
    try {
      const d = v.toDate ? v.toDate() : v; // Firestore Timestamp -> Date
      const dj = dayjs(d);
      return dj.isValid() ? dj.second(0).millisecond(0) : null;
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [ride]);

  const [pickupAt, setPickupAt] = useState(initialPickup);
  const [durationMin, setDurationMin] = useState(() => Number(ride?.rideDuration || 0));
  const [rideNotes, setRideNotes] = useState(ride?.rideNotes || "");

  const canSave = isValidDayjs(pickupAt) && Number.isFinite(durationMin) && durationMin >= 0;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      await patchRide(
        collectionName,
        ride.id, // ensure row.id is the Firestore doc id in your grids
        { pickupTime: pickupAt, rideDuration: durationMin, rideNotes },
        user?.email || "Unknown"
      );
      onClose(true);
    } catch (err) {
      console.error(err);
      onClose(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog open={open} onClose={() => onClose(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Ride</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <DateTimePicker
              label="Pickup At"
              ampm
              minutesStep={5}
              value={pickupAt}
              onChange={(v) => setPickupAt(isValidDayjs(v) ? v.second(0).millisecond(0) : null)}
              slotProps={{ textField: { fullWidth: true, required: true } }}
            />
            <TextField
              label="Duration (minutes)"
              type="number"
              inputProps={{ min: 0, step: 1 }}
              value={durationMin}
              onChange={(e) => setDurationMin(Math.max(0, Number(e.target.value ?? 0)))}
              fullWidth
              required
            />
            <TextField
              label="Notes"
              value={rideNotes}
              onChange={(e) => setRideNotes(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave} variant="contained" color="success">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
}
