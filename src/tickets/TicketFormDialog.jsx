import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import UploadIcon from "@mui/icons-material/UploadFile";
import CloseIcon from "@mui/icons-material/Close";

import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import AppError from "@/utils/AppError.js";
import logError from "@/utils/logError.js";
import { createTicket, DEFAULT_ASSIGNEES } from "@/services/tickets.js";
import { enqueueNotification } from "@/services/notify.js";
import { getUserContacts } from "@/services/users.js";
import { uploadTicketFiles } from "@/tickets/attachments.js";

const CATEGORY_OPTIONS = [
  { value: "vehicle", label: "Vehicle (Jim)" },
  { value: "marketing", label: "Marketing (Michael)" },
  { value: "tech", label: "Tech (Nate)" },
  { value: "moovs", label: "Moovs (Nate)" },
];

const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"];

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size % 1 === 0 ? size : size.toFixed(1)} ${units[unit]}`;
}

function normalizeWatcherValue(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed || null;
  }
  if (typeof raw === "object") {
    const candidate =
      raw.userId || raw.uid || raw.email || raw.id || raw.value || null;
    if (!candidate) return null;
    const trimmed = String(candidate).trim();
    return trimmed || null;
  }
  return null;
}

function normalizeWatchers(values = []) {
  const unique = new Set();
  const resolved = [];
  values.forEach((value) => {
    const normalized = normalizeWatcherValue(value);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (unique.has(key)) return;
    unique.add(key);
    resolved.push(normalized);
  });
  return resolved;
}

function deriveCreator(currentUser) {
  const userId =
    currentUser?.uid ||
    currentUser?.userId ||
    currentUser?.email ||
    currentUser?.id ||
    "unknown";
  const displayName =
    currentUser?.displayName ||
    currentUser?.name ||
    currentUser?.email ||
    "Unknown";
  return { userId, displayName };
}

function useInitialForm() {
  return useMemo(
    () => ({
      title: "",
      description: "",
      category: "tech",
      priority: "normal",
      watchers: [],
    }),
    [],
  );
}

export default function TicketFormDialog({ open, onClose, currentUser }) {
  const initialForm = useInitialForm();
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState([]);
  const [watcherInput, setWatcherInput] = useState("");
  const [busy, setBusy] = useState(false);
  const { show } = useSnack();

  const resetState = useCallback(() => {
    setForm({ ...initialForm, watchers: [] });
    setFiles([]);
    setWatcherInput("");
  }, [initialForm]);

  useEffect(() => {
    if (open) {
      resetState();
    }
  }, [open, resetState]);

  const updateField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleClose = useCallback(() => {
    if (busy) return;
    onClose?.();
  }, [busy, onClose]);

  const handleWatcherChange = useCallback((_, value) => {
    setForm((prev) => ({ ...prev, watchers: normalizeWatchers(value) }));
  }, []);

  const handleFileChange = useCallback((event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length) return;
    setFiles((prev) => {
      const map = new Map();
      prev.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        map.set(key, file);
      });
      selected.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        map.set(key, file);
      });
      return Array.from(map.values());
    });
  }, []);

  const removeFile = useCallback((index) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (busy) return;
    const title = String(form.title || "").trim();
    const description = String(form.description || "").trim();
    if (!title || !description) {
      show("Please provide a title and description.", "warning");
      return;
    }

    const creator = deriveCreator(currentUser);
    const categoryKey = (form.category || "tech").toLowerCase();
    const assignee = DEFAULT_ASSIGNEES[categoryKey] || DEFAULT_ASSIGNEES.tech;
    const watchers = normalizeWatchers(form.watchers);

    const targets = [];
    const targetKeys = new Set();
    const addTarget = (type, to) => {
      if (!type || !to) return;
      const key = `${type}:${String(to).toLowerCase()}`;
      if (targetKeys.has(key)) return;
      targetKeys.add(key);
      targets.push({ type, to });
    };

    const pushFromContact = (contact) => {
      if (!contact) return;
      if (contact.email) addTarget("email", contact.email);
      if (contact.phone) addTarget("sms", contact.phone);
      if (Array.isArray(contact.fcmTokens)) {
        contact.fcmTokens.forEach((token) => addTarget("fcm", token));
      }
    };

    const pushFallbackForWatcher = (watcher) => {
      if (!watcher) return;
      if (watcher.includes("@")) {
        addTarget("email", watcher);
      }
    };

    setBusy(true);
    try {
      const ticketId = await createTicket({
        ...form,
        title,
        description,
        watchers,
        createdBy: creator,
      });

      const lookupMap = new Map();
      lookupMap.set(creator.userId.toLowerCase(), creator.userId);
      if (assignee?.userId) {
        const id = String(assignee.userId);
        lookupMap.set(id.toLowerCase(), id);
      }
      watchers.forEach((watcher) => {
        lookupMap.set(watcher.toLowerCase(), watcher);
      });

      const lookupKeys = Array.from(lookupMap.keys());
      const lookupIds = lookupKeys.map((key) => lookupMap.get(key));
      const contacts = await Promise.all(
        lookupIds.map((id) => getUserContacts(id)),
      );

      contacts.forEach((contact, index) => {
        const lookupKey = lookupKeys[index];
        const originalId = lookupMap.get(lookupKey);
        const hasContactInfo = Boolean(
          contact &&
            (contact.email || contact.phone || contact.fcmTokens?.length),
        );
        if (hasContactInfo) {
          pushFromContact(contact);
          return;
        }
        if (watchers.some((value) => value.toLowerCase() === lookupKey)) {
          pushFallbackForWatcher(originalId);
        }
      });

      if (files.length) {
        try {
          await uploadTicketFiles(ticketId, files, currentUser);
        } catch (uploadError) {
          logError(uploadError, { where: "TicketFormDialog.upload", ticketId });
          show(
            "Ticket created but some attachments failed to upload.",
            "warning",
          );
        }
      }

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
              priority: form.priority || "normal",
              watchers,
            },
          },
        });
      }

      show("Support ticket created.", "success");
      resetState();
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
  }, [busy, currentUser, files, form, onClose, resetState, show]);

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
            disabled={busy}
          />
          <TextField
            label="Description"
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            fullWidth
            required
            multiline
            minRows={3}
            disabled={busy}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              label="Category"
              value={form.category}
              onChange={(event) => updateField("category", event.target.value)}
              fullWidth
              disabled={busy}
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
              fullWidth
              disabled={busy}
            >
              {PRIORITY_OPTIONS.map((level) => (
                <MenuItem key={level} value={level}>
                  {level}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Box>
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={form.watchers}
              onChange={handleWatcherChange}
              inputValue={watcherInput}
              onInputChange={(_, value) => setWatcherInput(value)}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option}
                    label={option}
                    size="small"
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Watchers"
                  placeholder="Add email or user ID"
                  disabled={busy}
                />
              )}
            />
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", mt: 0.5 }}
            >
              Watchers receive notifications alongside the assignee.
            </Typography>
          </Box>

          <Box>
            <Tooltip title="Upload screenshots, PDFs, or logs">
              <span>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  disabled={busy}
                >
                  Add attachments
                  <input
                    hidden
                    multiple
                    type="file"
                    onChange={handleFileChange}
                  />
                </Button>
              </span>
            </Tooltip>
            {files.length ? (
              <Stack spacing={1} sx={{ mt: 1 }}>
                {files.map((file, index) => (
                  <Box
                    key={`${file.name}-${file.lastModified}`}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      bgcolor: "rgba(255,255,255,0.04)",
                      borderRadius: 1,
                      px: 1.5,
                      py: 1,
                      gap: 1,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap>
                        {file.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        {formatFileSize(file.size)} • {file.type || "unknown"}
                      </Typography>
                    </Box>
                    <IconButton
                      onClick={() => removeFile(index)}
                      size="small"
                      aria-label={`Remove ${file.name}`}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", mt: 1 }}
              >
                Attachments are optional but help the team debug faster.
              </Typography>
            )}
          </Box>
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
