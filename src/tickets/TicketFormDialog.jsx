import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";

import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import AppError from "@/utils/AppError.js";
import logError from "@/utils/logError.js";
import { createTicket, DEFAULT_ASSIGNEES } from "@/services/tickets.js";
import { enqueueNotification } from "@/services/notify.js";
import { getUserContacts } from "@/services/users.js";

const CATEGORY_OPTIONS = [
  { value: "vehicle", label: "Vehicle (Jim)" },
  { value: "marketing", label: "Marketing (Michael)" },
  { value: "tech", label: "Tech (Nate)" },
  { value: "moovs", label: "Moovs (Nate)" },
];

const PRIORITIES = ["low", "normal", "high", "urgent"];

export default function TicketFormDialog({ open, onClose, currentUser }) {
  const initialState = useMemo(
    () => ({
      title: "",
      description: "",
      category: "tech",
      priority: "normal",
    }),
    [],
  );
  const [form, setForm] = useState(initialState);
  const [busy, setBusy] = useState(false);
  const { show } = useSnack();

  useEffect(() => {
    if (open) {
      setForm(initialState);
    }
  }, [initialState, open]);

  const updateField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleClose = useCallback(() => {
    if (busy) return;
    onClose?.();
  }, [busy, onClose]);

  const pushTargets = (targets, contact) => {
    if (!contact) return;
    if (contact.email) {
      targets.push({ type: "email", to: contact.email });
    }
    if (contact.phone) {
      targets.push({ type: "sms", to: contact.phone });
    }
    if (Array.isArray(contact.fcmTokens)) {
      contact.fcmTokens.forEach((token) => {
        targets.push({ type: "fcm", to: token });
      });
    }
  };

  const handleSubmit = useCallback(async () => {
    if (busy) return;
    const title = String(form.title || "").trim();
    const description = String(form.description || "").trim();
    if (!title || !description) {
      show("Please provide a title and description.", "warning");
      return;
    }

    const creatorId = currentUser?.uid || currentUser?.email || "unknown";
    const creatorName =
      currentUser?.displayName ||
      currentUser?.name ||
      currentUser?.email ||
      "Unknown";

    setBusy(true);
    try {
      const ticketId = await createTicket({
        ...form,
        title,
        description,
        createdBy: { userId: creatorId, displayName: creatorName },
      });

      const categoryKey = form.category || "tech";
      const assignee = DEFAULT_ASSIGNEES[categoryKey] || DEFAULT_ASSIGNEES.tech;

      const [creatorContact, assigneeContact] = await Promise.all([
        getUserContacts(creatorId),
        getUserContacts(assignee.userId),
      ]);

      const targets = [];
      pushTargets(targets, creatorContact);
      pushTargets(targets, assigneeContact);

      if (targets.length) {
        await enqueueNotification({
          targets,
          template: "ticket_created",
          context: {
            ticketId,
            ticket: {
              id: ticketId,
              title,
              description,
              status: "open",
              category: categoryKey,
              priority: form.priority,
            },
          },
        });
      }

      show("Support ticket created and notifications queued.", "success");
      onClose?.({ ticketId });
    } catch (error) {
      const appErr =
        error instanceof AppError
          ? error
          : new AppError(
              error?.message || "Failed to create ticket",
              "TICKET_DIALOG_ERROR",
            );
      logError(appErr, { where: "TicketFormDialog.submit" });
      show(appErr.message || "Failed to create support ticket.", "error");
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    currentUser?.displayName,
    currentUser?.email,
    currentUser?.name,
    currentUser?.uid,
    form,
    onClose,
    show,
  ]);

  const disableSubmit =
    busy ||
    !String(form.title || "").trim() ||
    !String(form.description || "").trim();

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>New Support Ticket</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Title"
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            fullWidth
            required
          />
          <TextField
            label="Description"
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            fullWidth
            required
            multiline
            minRows={3}
          />
          <TextField
            select
            label="Category"
            value={form.category}
            onChange={(event) => updateField("category", event.target.value)}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Priority"
            value={form.priority}
            onChange={(event) => updateField("priority", event.target.value)}
          >
            {PRIORITIES.map((level) => (
              <MenuItem key={level} value={level}>
                {level}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={disableSubmit}
          sx={{ bgcolor: "#4cbb17", "&:hover": { bgcolor: "#3aa40f" } }}
        >
          {busy ? "Creating..." : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
