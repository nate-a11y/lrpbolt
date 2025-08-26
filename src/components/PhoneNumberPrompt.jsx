import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { doc, setDoc } from "firebase/firestore";

import { db } from "../utils/firebaseInit";

export default function PhoneNumberPrompt({ open, email, onClose }) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setPhone("");
      setError("");
    }
  }, [open]);

  const handleSave = useCallback(async () => {
    let trimmed = phone.trim();
    let digits = trimmed.replace(/\D/g, "");

    if (trimmed.startsWith("+")) {
      trimmed = "+" + digits;
    } else if (digits.length === 10) {
      trimmed = `+1${digits}`;
    } else {
      trimmed = `+${digits}`;
    }

    if (!/^\+[1-9]\d{9,14}$/.test(trimmed)) {
      setError("Enter phone number in +1234567890 format.");
      return;
    }

    try {
      setLoading(true);
      await setDoc(doc(db, "userAccess", email.toLowerCase()), { phone: trimmed }, { merge: true });
      onClose();
    } catch (e) {
      console.error("[PhoneNumberPrompt] save error:", e?.message || e);
      setError("Failed to save. Try again.");
    } finally {
      setLoading(false);
    }
  }, [phone, email, onClose]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Enter Phone Number</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography>Please provide a phone number for notifications in international format.</Typography>
          <TextField
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoFocus
            disabled={loading}
            error={!!error}
            helperText={error || " "}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          {loading ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

