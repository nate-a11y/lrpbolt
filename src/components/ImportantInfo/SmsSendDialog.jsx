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

import LoadingButtonLite from "@/components/inputs/LoadingButtonLite.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import { sendPartnerInfo } from "@/services/smsService.js";
import logError from "@/utils/logError.js";

function buildMessagePreview(item) {
  if (!item) return "";
  if (item.smsTemplate) return item.smsTemplate;
  const lines = [
    item.title ? `${item.title}` : "Important Info",
    item.blurb ? `${item.blurb}` : null,
    item.details ? `${item.details}` : null,
    item.phone ? `Phone: ${item.phone}` : null,
    item.url ? `More: ${item.url}` : null,
    "— Sent via Lake Ride Pros",
  ].filter(Boolean);
  const message = lines.join("\n").trim();
  return message.length > 840 ? `${message.slice(0, 837)}…` : message;
}

function normalizeInitialPhone(value) {
  if (!value || typeof value !== "string") return "";
  return value.trim();
}

export default function SmsSendDialog({ open, onClose, item }) {
  const { show } = useSnack();
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setPhone(normalizeInitialPhone(item?.phone));
    } else {
      setPhone("");
      setSending(false);
    }
  }, [open, item?.phone]);

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
      if (!trimmed) {
        show("Enter a destination phone number.", "warning");
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
        show("Failed to send SMS. Please try again.", "error");
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
            onChange={(event) => setPhone(event.target.value)}
            autoFocus
            placeholder="e.g. +15551234567 or 5551234567"
            disabled={sending}
            fullWidth
          />
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: "rgba(76,187,23,0.08)",
              border: "1px solid rgba(76,187,23,0.32)",
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600, color: "#4cbb17", mb: 1 }}
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
        <Button onClick={handleClose} disabled={sending}>
          Cancel
        </Button>
        <LoadingButtonLite
          type="submit"
          loading={sending}
          loadingText="Sending…"
          variant="contained"
          sx={{
            bgcolor: "#4cbb17",
            "&:hover": { bgcolor: "#3aa40f" },
          }}
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
