import React, { useCallback, useEffect, useState } from "react";
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
    const trimmed = phone.trim();
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Enter a valid phone number.");
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
          <Typography>Please provide a phone number for notifications.</Typography>
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

