/* Proprietary and confidential. See LICENSE. */
import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  useMediaQuery,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers-pro";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useTheme } from "@mui/material/styles";

import { isValidDayjs, tsToDayjs } from "../utils/dates"; // extended dayjs with tz
import { patchRide } from "../services/rides";
import useAuth from "../hooks/useAuth";
import { RIDE_FIELDS } from "../constants/schemaFields";

import DateTimeFieldPro from "./fields/DateTimeFieldPro.jsx";

const NUM_FIELDS = new Set(["rideDuration"]);

const toDayjsOrNull = (value) => {
  const dj = tsToDayjs(value);
  return isValidDayjs(dj) ? dj : null;
};

export default function EditRideDialog({
  open,
  onClose,
  collectionName,
  ride,
}) {
  const { user } = useAuth();
  const theme = useTheme();
  const fullOnXs = useMediaQuery(theme.breakpoints.down("sm"));
  const isTsField = useCallback((f) => {
    if (!f || typeof f !== "string") return false;
    const lower = f.toLowerCase();
    return lower.includes("time") || lower.endsWith("at");
  }, []);

  const initForm = useCallback(() => {
    const base = {
      tripId: ride?.tripId ?? "",
      pickupTime: ride?.pickupTime ?? null,
      rideType: ride?.rideType ?? "",
      vehicle: ride?.vehicle ?? "",
      rideDuration: ride?.rideDuration ?? 0,
      rideNotes: ride?.rideNotes ?? "",
    };

    const obj = { ...base };

    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      if (isTsField(key)) {
        obj[key] = toDayjsOrNull(value);
      } else if (value && typeof value.toDate === "function") {
        obj[key] = toDayjsOrNull(value.toDate());
      }
    });

    RIDE_FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(obj, field)) {
        if (isTsField(field)) {
          obj[field] = toDayjsOrNull(obj[field]);
        }
        return;
      }
      const upperField =
        field && field.length
          ? field.charAt(0).toUpperCase() + field.slice(1)
          : field;
      const value =
        ride?.[field] ??
        ride?._raw?.[field] ??
        (upperField && ride?._raw?.[upperField]);
      if (isTsField(field)) {
        obj[field] = toDayjsOrNull(value);
      } else if (value && typeof value.toDate === "function") {
        obj[field] = toDayjsOrNull(value.toDate());
      } else if (NUM_FIELDS.has(field)) {
        obj[field] = value == null || value === "" ? 0 : Number(value);
      } else {
        obj[field] = value ?? "";
      }
    });

    return obj;
  }, [ride, isTsField]);

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

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog
        open={open}
        onClose={() => onClose(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={fullOnXs}
      >
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
                    onChange={(v) =>
                      handleChange(field, isValidDayjs(v) ? v : null)
                    }
                  />
                );
              }
              return (
                <TextField
                  key={field}
                  label={field}
                  value={val ?? ""}
                  onChange={(e) =>
                    handleChange(
                      field,
                      NUM_FIELDS.has(field)
                        ? Number(e.target.value)
                        : e.target.value,
                    )
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
          <Button
            onClick={() => onClose(false)}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
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
