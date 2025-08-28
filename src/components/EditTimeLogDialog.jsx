/* Proprietary and confidential. See LICENSE. */
import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField, useMediaQuery } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers-pro";
// eslint-disable-next-line import/no-unresolved
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useTheme } from "@mui/material/styles";

import dayjs, { isValidDayjs } from "../utils/dates";
import { patchTimeLog } from "../services/timeLogs";
import { TIMELOG_FIELDS } from "../constants/schemaFields";

import DateTimeFieldPro from "./fields/DateTimeFieldPro.jsx";

export default function EditTimeLogDialog({ open, log, onClose }) {
  const initForm = useCallback(() => {
    const obj = {};
    TIMELOG_FIELDS.forEach((f) => {
      const v = log?.[f];
      if (typeof v === "object" && typeof v.toDate === "function") {
        obj[f] = dayjs(v.toDate());
      } else {
        obj[f] = v ?? "";
      }
    });
    return obj;
  }, [log]);

  const [form, setForm] = useState(initForm);
  useEffect(() => {
    setForm(initForm());
  }, [initForm]);

  const handleChange = (field, value) => {
    setForm((s) => ({ ...s, [field]: value }));
  };

  const canSave =
    isValidDayjs(form.startTime) &&
    isValidDayjs(form.endTime) &&
    !form.endTime.isBefore(form.startTime);

  const handleSave = async () => {
    if (!log?.id) return;
    try {
      await patchTimeLog(log.id, {
        startTime: form.startTime?.toDate(),
        endTime: form.endTime?.toDate(),
        rideId: form.rideId || "",
        note: form.note || "",
      });
      onClose(true);
    } catch (err) {
      console.error(err);
      onClose(false);
    }
  };

  const isTsField = (f) => f.toLowerCase().includes("time") || f.toLowerCase().endsWith("at");
  const NUM_FIELDS = new Set(["duration"]);
  const theme = useTheme();
  const fullOnXs = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog open={open} onClose={() => onClose(false)} maxWidth="sm" fullWidth fullScreen={fullOnXs}>
        <DialogTitle>Edit Time Log</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            {TIMELOG_FIELDS.map((field) => {
              const val = form[field];
              if (isTsField(field)) {
                return (
                  <DateTimeFieldPro
                    key={field}
                    label={field}
                    value={val}
                    onChange={(v) => handleChange(field, isValidDayjs(v) ? v : null)}
                  />
                );
              }
              return (
                <TextField
                  key={field}
                  label={field}
                  value={val ?? ""}
                  onChange={(e) =>
                    handleChange(field, NUM_FIELDS.has(field) ? Number(e.target.value) : e.target.value)
                  }
                  type={NUM_FIELDS.has(field) ? "number" : "text"}
                  fullWidth
                  margin="dense"
                />
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose(false)} sx={{ width: { xs: "100%", sm: "auto" } }}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            variant="contained"
            color="success"
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
}
