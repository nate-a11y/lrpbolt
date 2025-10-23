import * as React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  Chip,
  LinearProgress,
  InputAdornment,
  IconButton,
  Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import ClearIcon from "@mui/icons-material/Clear";

import logError from "@/utils/logError.js";
import { dayjs } from "@/utils/time";
import { createTicket } from "@/services/tickets.js";
import { enqueueNotification } from "@/services/notify.js";
import { getUserContacts } from "@/services/users.js";

import { uploadTicketFiles } from "./attachments.js";

const CATS = [
  { value: "vehicle", label: "Vehicle Issue (→ Jim)" },
  { value: "marketing", label: "Marketing (→ Michael)" },
  { value: "tech", label: "Tech (→ Nate)" },
  { value: "moovs", label: "Moovs (→ Nate)" },
];

const PRIORITIES = ["low", "normal", "high", "urgent"];

const EMAIL_PATTERN = /@/;

function sanitizePhone(value) {
  if (!value) return "";
  return String(value).replace(/[^+\d]/g, "");
}

function looksLikePhone(value) {
  if (!value) return false;
  const digits = sanitizePhone(value);
  return digits.length >= 10;
}

function looksLikeEmail(value) {
  if (!value) return false;
  return EMAIL_PATTERN.test(String(value));
}

function addFallbackTargets(identifier, pushTarget) {
  const trimmed = String(identifier || "").trim();
  if (!trimmed) return;
  if (looksLikeEmail(trimmed)) {
    pushTarget("email", trimmed.toLowerCase());
    return;
  }
  if (looksLikePhone(trimmed)) {
    pushTarget("sms", sanitizePhone(trimmed));
  }
}

function assigneePreview(cat) {
  if (cat === "vehicle") return { id: "jim", name: "Jim" };
  if (cat === "marketing") return { id: "michael", name: "Michael" };
  return { id: "nate", name: "Nate" };
}

export default function TicketFormDialog({
  open,
  onClose,
  currentUser,
  onSaved,
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("tech");
  const [priority, setPriority] = React.useState("normal");
  const [files, setFiles] = React.useState([]);
  const [watchers, setWatchers] = React.useState([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [busyText, setBusyText] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    try {
      const q = new URLSearchParams(window.location.hash.split("?")[1] || "");
      const cat = String(q.get("cat") || "").toLowerCase();
      if (["vehicle", "marketing", "tech", "moovs"].includes(cat)) {
        setCategory(cat);
      }
    } catch (err) {
      logError(err, { where: "TicketFormDialog.prefillCategory" });
    }
  }, [open]);

  React.useEffect(() => {
    if (open) return;
    setTitle("");
    setDescription("");
    setCategory("tech");
    setPriority("normal");
    setFiles([]);
    setWatchers([]);
    setSubmitting(false);
    setBusyText("");
  }, [open]);

  const canSubmit = title.trim().length >= 3 && description.trim().length >= 5;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      setBusyText("Creating ticket…");
      const creatorId =
        currentUser?.uid ||
        currentUser?.id ||
        currentUser?.userId ||
        currentUser?.email ||
        null;

      const {
        id: ticketId,
        watchers: watcherIds,
        assignee,
        ticket: snapshot,
      } = await createTicket({
        title,
        description,
        category,
        priority,
        watchers,
        createdBy: {
          userId: currentUser?.uid || currentUser?.id || "unknown",
          displayName:
            currentUser?.displayName || currentUser?.name || "Unknown",
        },
      });

      if (files.length) {
        setBusyText("Uploading attachments…");
        try {
          await uploadTicketFiles(ticketId, files, currentUser);
        } catch (err) {
          logError(err, { where: "TicketFormDialog.upload" });
        }
      }

      setBusyText("Resolving contacts…");

      const lookupIds = new Set(
        Array.isArray(watcherIds) ? watcherIds.filter(Boolean) : [],
      );
      if (creatorId) lookupIds.add(creatorId);
      if (assignee?.userId) lookupIds.add(assignee.userId);

      const contactEntries = await Promise.all(
        Array.from(lookupIds).map(async (id) => {
          try {
            const info = await getUserContacts(id);
            return [id, info];
          } catch (err) {
            logError(err, { where: "TicketFormDialog.contacts", id });
            return [id, null];
          }
        }),
      );

      const targetsMap = new Map();
      const pushTarget = (type, raw) => {
        if (!type || !raw) return;
        const normalizedType = String(type).trim().toLowerCase();
        if (!normalizedType) return;
        const sanitizedValue =
          normalizedType === "sms" ? sanitizePhone(raw) : String(raw).trim();
        if (!sanitizedValue) return;
        const key = `${normalizedType}:${sanitizedValue}`;
        if (targetsMap.has(key)) return;
        targetsMap.set(key, { type: normalizedType, to: sanitizedValue });
      };

      if (currentUser?.email) {
        pushTarget("email", currentUser.email);
      }
      if (currentUser?.phoneNumber) {
        pushTarget("sms", currentUser.phoneNumber);
      }

      (currentUser?.fcmTokens || []).forEach((token) =>
        pushTarget("fcm", token),
      );

      contactEntries.forEach(([id, info]) => {
        if (info) {
          if (info.email) pushTarget("email", info.email);
          if (info.phone) pushTarget("sms", info.phone);
          (info.fcmTokens || []).forEach((token) => pushTarget("fcm", token));
        }
        addFallbackTargets(id, pushTarget);
      });

      watchers.forEach((value) => addFallbackTargets(value, pushTarget));

      const targets = Array.from(targetsMap.values());

      if (targets.length) {
        setBusyText("Queueing notifications…");
        await enqueueNotification({
          targets,
          template: "ticket_created",
          context: {
            ticketId,
            link: `${window.location.origin}/#/tickets?id=${ticketId}`,
            ticket: {
              id: ticketId,
              title: snapshot?.title || title,
              description: snapshot?.description || description,
              category: snapshot?.category || category,
              status: snapshot?.status || "open",
              priority: snapshot?.priority || priority,
            },
          },
        });
      } else if (import.meta.env?.DEV) {
        console.warn(
          "[LRP] No notification targets resolved for ticket",
          ticketId,
        );
      }

      const now = dayjs();
      onSaved?.({
        id: ticketId,
        title: snapshot?.title || title,
        description: snapshot?.description || description,
        category: snapshot?.category || category,
        priority: snapshot?.priority || priority,
        status: snapshot?.status || "open",
        assignee,
        watchers: Array.isArray(watcherIds) ? watcherIds : [],
        createdBy: snapshot?.createdBy || {
          userId: currentUser?.uid || currentUser?.id || "unknown",
          displayName:
            currentUser?.displayName || currentUser?.name || "Unknown",
        },
        createdAt: now,
        updatedAt: now,
      });

      onClose?.();
    } catch (err) {
      logError(err, { where: "TicketFormDialog.submit" });
      setSubmitting(false);
      setBusyText("");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>New Support Ticket</DialogTitle>
      <DialogContent dividers>
        {submitting ? <LinearProgress sx={{ mb: 2 }} /> : null}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Title *"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
            fullWidth
            helperText={`${Math.max(0, 3 - title.trim().length)} more char(s) required`}
            InputProps={{ inputProps: { maxLength: 120 } }}
          />
          <TextField
            label="Description *"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            fullWidth
            multiline
            minRows={3}
            helperText={`${Math.max(0, 5 - description.trim().length)} more char(s) required`}
          />
          <TextField
            select
            label="Category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            helperText={`Assigned to ${assigneePreview(category).name}`}
          >
            {CATS.map((cat) => (
              <MenuItem key={cat.value} value={cat.value}>
                {cat.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            {PRIORITIES.map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Watchers (optional, comma-separated emails or userIds)"
            placeholder="e.g. jim@..., michael@..., nate"
            onBlur={(event) => {
              const raw = String(event.target.value || "");
              const arr = raw
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean);
              setWatchers(arr);
            }}
            InputProps={{
              endAdornment: watchers.length ? (
                <InputAdornment position="end">
                  <Tooltip title="Clear watchers">
                    <IconButton onClick={() => setWatchers([])} size="small">
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ) : null,
            }}
            helperText={
              watchers.length
                ? watchers.map((watcher) => (
                    <Chip
                      key={watcher}
                      size="small"
                      label={watcher}
                      sx={{ mr: 0.5 }}
                    />
                  ))
                : " "
            }
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              component="label"
              htmlFor="ticket-form-file-upload"
              startIcon={<AttachFileIcon />}
              variant="outlined"
            >
              Attach files
              <input
                id="ticket-form-file-upload"
                style={{ display: "none" }}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt,.log"
                onChange={(event) =>
                  setFiles(Array.from(event.target.files || []))
                }
              />
            </Button>
            {files.length ? (
              <Chip
                label={`${files.length} file(s) selected`}
                size="small"
                onDelete={() => setFiles([])}
              />
            ) : null}
          </Stack>
          <Chip
            color="default"
            label={`Assigned to: ${assigneePreview(category).name}`}
            sx={{
              alignSelf: "flex-start",
              bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
              color: (t) => t.palette.primary.main,
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          variant="contained"
          sx={{
            backgroundColor: (t) => t.palette.primary.main,
            "&:hover": { backgroundColor: (t) => t.palette.primary.dark },
          }}
        >
          {submitting ? busyText || "Working…" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
