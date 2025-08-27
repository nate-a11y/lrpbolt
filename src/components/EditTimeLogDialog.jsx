/* Proprietary and confidential. See LICENSE. */
// src/components/EditTimeLogDialog.jsx
import { useState, useEffect } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers-pro";
import { AdapterDayjs } from "@mui/x-date-pickers-pro/AdapterDayjs";

import dayjs, { isValidDayjs } from "../utils/dates";
import { patchTimeLog } from "../services/timeLogs";

import DateTimeFieldPro from "./fields/DateTimeFieldPro.jsx";

export default function EditTimeLogDialog({ open, log, onClose }) {
  const initStart = log?.startTime
    ? dayjs(log.startTime.toDate ? log.startTime.toDate() : log.startTime)
    : null;
  const initEnd = log?.endTime
    ? dayjs(log.endTime.toDate ? log.endTime.toDate() : log.endTime)
    : null;

  const [startAt, setStartAt] = useState(initStart);
  const [endAt, setEndAt] = useState(initEnd);
  const [rideId, setRideId] = useState(log?.rideId || "");
  const [note, setNote] = useState(log?.note || "");

  useEffect(() => {
    setStartAt(initStart);
    setEndAt(initEnd);
    setRideId(log?.rideId || "");
    setNote(log?.note || "");
  }, [log, initStart, initEnd]);

  const canSave = isValidDayjs(startAt) && isValidDayjs(endAt) && !endAt.isBefore(startAt);

  const handleSave = async () => {
    if (!log?.id) return;
    try {
      await patchTimeLog(log.id, {
        startTime: startAt?.toDate(),
        endTime: endAt?.toDate(),
        rideId: rideId || "",
        note,
      });
      onClose(true);
      } catch (err) {
        console.error(err);
        onClose(false);
      }
    };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog open={open} onClose={() => onClose(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Time Log</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <DateTimeFieldPro
              label="Clock In"
              value={startAt}
              onChange={(v) => setStartAt(isValidDayjs(v) ? v : null)}
            />
            <DateTimeFieldPro
              label="Clock Out"
              value={endAt}
              onChange={(v) => setEndAt(isValidDayjs(v) ? v : null)}
            />
            <TextField label="Ride ID" value={rideId} onChange={(e) => setRideId(e.target.value)} fullWidth />
            <TextField
              label="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
