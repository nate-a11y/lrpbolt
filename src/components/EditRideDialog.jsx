/* Proprietary and confidential. See LICENSE. */
import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers-pro";
import { AdapterDayjs } from "@mui/x-date-pickers-pro/AdapterDayjs";

import dayjs, { isValidDayjs } from "../utils/dates"; // extended dayjs with tz
import { patchRide } from "../services/rides";
import useAuth from "../hooks/useAuth";
import { RIDE_FIELDS } from "../constants/schemaFields";

import DateTimeFieldPro from "./fields/DateTimeFieldPro.jsx";

const NUM_FIELDS = new Set(["rideDuration"]);

export default function EditRideDialog({ open, onClose, collectionName, ride }) {
  const { user } = useAuth();

  const initForm = useCallback(() => {
    const obj = {};
    RIDE_FIELDS.forEach((f) => {
      const v = ride?.[f];
      if (typeof v === "object" && typeof v.toDate === "function") {
        obj[f] = dayjs(v.toDate());
      } else {
        obj[f] = v ?? "";
      }
    });
    return obj;
  }, [ride]);

  const [form, setForm] = useState(initForm);
  useEffect(() => {
    setForm(initForm());
  }, [initForm]);

  const handleChange = (field, value) => {
    setForm((s) => ({ ...s, [field]: value }));
  };

  const handleSave = async () => {
    try {
      await patchRide(collectionName, ride.id, form, user?.email || "Unknown");
      onClose(true);
    } catch (err) {
      console.error(err);
      onClose(false);
    }
  };

  const isTsField = (f) => f.toLowerCase().includes("time") || f.toLowerCase().endsWith("at");

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog open={open} onClose={() => onClose(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Ride</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            {RIDE_FIELDS.map((field) => {
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
          <Button onClick={() => onClose(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" color="success">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
}
