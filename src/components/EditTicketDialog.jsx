/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { LocalizationProvider, DateTimePicker } from "@mui/x-date-pickers-pro";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

import { dayjs } from "@/utils/time";

import { updateTicket } from "../hooks/api";
import logError from "../utils/logError.js";

export default function EditTicketDialog({ open, ticket, onClose }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [form, setForm] = useState({});

  useEffect(() => {
    if (ticket) {
      setForm({
        passenger: ticket.passenger || "",
        passengers: ticket.passengers ?? "",
        pickup: ticket.pickup || "",
        dropoff: ticket.dropoff || "",
        notes: ticket.notes || "",
        pickupTime: ticket.pickupTime
          ? dayjs(
              ticket.pickupTime.toDate
                ? ticket.pickupTime.toDate()
                : ticket.pickupTime,
            )
          : null,
      });
    }
  }, [ticket]);

  const handleChange = (field, value) => {
    setForm((s) => ({ ...s, [field]: value }));
  };

  const handleSave = async () => {
    try {
      const payload = {
        passenger: form.passenger || null,
        pickup: form.pickup || null,
        dropoff: form.dropoff || null,
        notes: form.notes || null,
        passengers:
          form.passengers === "" ? null : Number(form.passengers) || null,
        pickupTime: form.pickupTime ? form.pickupTime.toDate() : null,
      };
      await updateTicket(ticket.ticketId, payload);
      onClose({ ...ticket, ...payload });
    } catch (e) {
      logError(e, "EditTicketDialog.save");
      onClose(null);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog
        open={open}
        onClose={() => onClose(null)}
        maxWidth="sm"
        fullWidth
        fullScreen={fullScreen}
      >
        <DialogTitle>Edit Ticket</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Passenger"
              value={form.passenger}
              onChange={(e) => handleChange("passenger", e.target.value)}
              fullWidth
            />
            <TextField
              label="Passengers"
              type="number"
              value={form.passengers}
              onChange={(e) => handleChange("passengers", e.target.value)}
              fullWidth
            />
            <DateTimePicker
              label="Pickup Time"
              value={form.pickupTime}
              onChange={(v) =>
                handleChange(
                  "pickupTime",
                  v && dayjs(v).isValid() ? dayjs(v) : null,
                )
              }
              slotProps={{ textField: { fullWidth: true } }}
            />
            <TextField
              label="Pickup"
              value={form.pickup}
              onChange={(e) => handleChange("pickup", e.target.value)}
              fullWidth
            />
            <TextField
              label="Dropoff"
              value={form.dropoff}
              onChange={(e) => handleChange("dropoff", e.target.value)}
              fullWidth
            />
            <TextField
              label="Notes"
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              multiline
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => onClose(null)}
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
