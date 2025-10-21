// allow-color-literal-file

import { useState, useEffect, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
  Typography,
  Button,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import LoadingButtonLite from "@/components/inputs/LoadingButtonLite.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import { sendPartnerInfo } from "@/services/smsService.js";
import logError from "@/utils/logError.js";

const SMS_FOOTER =
  "— Sent from a Lake Ride Pros automated number. Replies are not monitored.";

function buildMessagePreview(item) {
  if (!item) return "";
  const appendFooter = (base) => {
    const trimmed = base.trim();
    return `${trimmed}\n${SMS_FOOTER}`;
  };
  if (item.smsTemplate) {
    return appendFooter(item.smsTemplate);
  }
  const lines = [
    item.title ? `${item.title}` : "Important Info",
    item.blurb ? `${item.blurb}` : null,
    item.details ? `${item.details}` : null,
    item.phone ? `Phone: ${item.phone}` : null,
    item.url ? `More: ${item.url}` : null,
    SMS_FOOTER,
  ].filter(Boolean);
  const message = lines.join("\n").trim();
  return message.length > 840 ? `${message.slice(0, 837)}…` : message;
}

export default function SmsSendDialog({ open, onClose, item }) {
  const { show } = useSnack();
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPhone("");
    setSending(false);
    setError("");
  }, [open]);

  const preview = useMemo(() => buildMessagePreview(item), [item]);

  const handleClose = useCallback(() => {
    if (sending) return;
    if (onClose) onClose();
  }, [onClose, sending]);

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault();
      if (!item?.id) return;
      const trimmed = phone.trim();
      setError("");
      if (!trimmed) {
        setError("Enter a phone number.");
        return;
      }
      setSending(true);
      try {
        await sendPartnerInfo({ to: trimmed, itemId: item.id });
        show("SMS sent successfully.", "success");
        if (onClose) onClose();
      } catch (error) {
        logError(error, {
          where: "SmsSendDialog.handleSubmit",
          itemId: item?.id,
        });
        const message =
          error?.message || "Failed to send SMS. Please try again.";
        if (error?.code === "sms_invalid_phone") {
          setError(message);
          show(message, "warning");
        } else {
          setError("");
          show(message, "error");
        }
      } finally {
        setSending(false);
      }
    },
    [item, onClose, phone, show],
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      component="form"
      onSubmit={handleSubmit}
      sx={{ "& .MuiPaper-root": { bgcolor: "background.paper" } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Text to Customer</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Destination phone"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              if (error) setError("");
            }}
            autoFocus
            placeholder="e.g. +15551234567 or 5551234567"
            disabled={sending}
            fullWidth
            error={Boolean(error)}
            helperText={
              error ||
              "Enter the customer’s phone. This is not stored, and replies are not monitored."
            }
            inputProps={{
              inputMode: "tel",
              "aria-label": "Customer phone number",
            }}
          />
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
              border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.32)}`,
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                color: (t) => t.palette.primary.main,
                mb: 1,
              }}
            >
              Message preview
            </Typography>
            <Typography
              component="pre"
              sx={{
                m: 0,
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
                fontSize: "0.95rem",
                color: "text.primary",
              }}
            >
              {preview || "No message available."}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={handleClose}
          disabled={sending}
          aria-label="Cancel sending SMS"
        >
          Cancel
        </Button>
        <LoadingButtonLite
          type="submit"
          loading={sending}
          loadingText="Sending…"
          variant="contained"
          sx={{
            bgcolor: (t) => t.palette.primary.main,
            "&:hover": { bgcolor: "#3aa40f" },
          }}
          aria-label="Send SMS to entered phone number"
        >
          Send SMS
        </LoadingButtonLite>
      </DialogActions>
    </Dialog>
  );
}

SmsSendDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  item: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    blurb: PropTypes.string,
    details: PropTypes.string,
    phone: PropTypes.string,
    url: PropTypes.string,
    smsTemplate: PropTypes.string,
  }),
};
