import * as React from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import UploadIcon from "@mui/icons-material/UploadFile";
import VisibilityIcon from "@mui/icons-material/Visibility";

import {
  addTicketComment,
  updateTicket,
  addWatcher,
} from "@/services/tickets.js";
import { getUserContacts } from "@/services/users.js";
import { formatDateTime } from "@/utils/time";
import logError from "@/utils/logError.js";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import { APP_BAR_HEIGHT } from "@/layout/constants.js";

import { subscribeTicketAttachments, uploadTicketFiles } from "./attachments";

const STATUS_OPTIONS = [
  "open",
  "in_progress",
  "resolved",
  "closed",
  "breached",
];
const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"];

export default function TicketDetailDrawer({
  open,
  onClose,
  ticket,
  currentUser,
}) {
  const [comment, setComment] = React.useState("");
  const [commentBusy, setCommentBusy] = React.useState(false);
  const [updateBusy, setUpdateBusy] = React.useState(false);
  const [uploadBusy, setUploadBusy] = React.useState(false);
  const [watcherBusy, setWatcherBusy] = React.useState(false);
  const [attachments, setAttachments] = React.useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = React.useState(false);
  const [attachmentsError, setAttachmentsError] = React.useState(null);
  const [watcherContacts, setWatcherContacts] = React.useState({});
  const { show } = useSnack();

  const ticketId = ticket?.id || null;
  const watchers = React.useMemo(
    () =>
      Array.isArray(ticket?.watchers)
        ? Array.from(new Set(ticket.watchers))
        : [],
    [ticket?.watchers],
  );

  const currentUserId = React.useMemo(() => {
    return (
      currentUser?.uid ||
      currentUser?.email ||
      currentUser?.id ||
      currentUser?.userId ||
      null
    );
  }, [
    currentUser?.email,
    currentUser?.id,
    currentUser?.uid,
    currentUser?.userId,
  ]);

  const isWatching = React.useMemo(() => {
    if (!currentUserId) return false;
    return watchers.includes(currentUserId);
  }, [currentUserId, watchers]);

  React.useEffect(() => {
    if (!open) {
      setComment("");
      return;
    }
    setComment("");
  }, [open, ticketId]);

  React.useEffect(() => {
    if (!open || !ticketId) {
      setAttachments([]);
      return () => {};
    }
    setAttachmentsLoading(true);
    setAttachmentsError(null);
    const unsubscribe = subscribeTicketAttachments(
      ticketId,
      ({ rows, error }) => {
        if (error) {
          setAttachmentsError(error);
          setAttachmentsLoading(false);
          return;
        }
        setAttachments(rows || []);
        setAttachmentsLoading(false);
      },
    );
    return () => {
      try {
        unsubscribe?.();
      } catch (err) {
        logError(err, { where: "TicketDetailDrawer.cleanup.attachments" });
      }
    };
  }, [open, ticketId]);

  React.useEffect(() => {
    if (!open || !watchers.length) {
      setWatcherContacts({});
      return;
    }
    let cancelled = false;
    Promise.all(
      watchers.map(async (id) => {
        try {
          const info = await getUserContacts(id);
          return [id, info];
        } catch (err) {
          logError(err, { where: "TicketDetailDrawer.loadWatcher", id });
          return [id, null];
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      const next = {};
      entries.forEach(([id, info]) => {
        if (!id) return;
        next[id] = info || {};
      });
      setWatcherContacts(next);
    });
    return () => {
      cancelled = true;
    };
  }, [open, ticketId, watchers]);

  const handleCommentSubmit = React.useCallback(async () => {
    const trimmed = comment.trim();
    if (!ticketId || !trimmed) return;
    setCommentBusy(true);
    try {
      await addTicketComment(ticketId, {
        body: trimmed,
        author: {
          userId: currentUserId,
          displayName:
            currentUser?.displayName ||
            currentUser?.name ||
            currentUser?.email ||
            "Unknown",
        },
      });
      setComment("");
      show("Comment added.", "success");
    } catch (error) {
      logError(error, { where: "TicketDetailDrawer.comment", ticketId });
      show(error?.message || "Failed to add comment.", "error");
    } finally {
      setCommentBusy(false);
    }
  }, [
    comment,
    currentUser?.displayName,
    currentUser?.email,
    currentUser?.name,
    currentUserId,
    show,
    ticketId,
  ]);

  const handleFieldChange = React.useCallback(
    async (field, value) => {
      if (!ticketId) return;
      setUpdateBusy(true);
      try {
        await updateTicket(ticketId, { [field]: value });
        show(`Support ticket ${field} updated.`, "success");
      } catch (error) {
        logError(error, {
          where: "TicketDetailDrawer.update",
          ticketId,
          field,
        });
        show(error?.message || "Failed to update support ticket.", "error");
      } finally {
        setUpdateBusy(false);
      }
    },
    [show, ticketId],
  );

  const handleUploadFiles = React.useCallback(
    async (event) => {
      if (!ticketId) return;
      const files = Array.from(event.target.files || []);
      event.target.value = "";
      if (!files.length) return;
      setUploadBusy(true);
      try {
        await uploadTicketFiles(ticketId, files, currentUser);
        show(
          `${files.length} file${files.length > 1 ? "s" : ""} uploaded.`,
          "success",
        );
      } catch (error) {
        logError(error, { where: "TicketDetailDrawer.upload", ticketId });
        show(error?.message || "Failed to upload attachment.", "error");
      } finally {
        setUploadBusy(false);
      }
    },
    [currentUser, show, ticketId],
  );

  const handleAddWatcher = React.useCallback(async () => {
    if (!ticketId || !currentUserId) return;
    setWatcherBusy(true);
    try {
      await addWatcher(ticketId, currentUserId);
      show("Added to watchers.", "success");
    } catch (error) {
      logError(error, { where: "TicketDetailDrawer.addWatcher", ticketId });
      show(error?.message || "Unable to add watcher.", "error");
    } finally {
      setWatcherBusy(false);
    }
  }, [currentUserId, show, ticketId]);

  const handleClose = React.useCallback(() => {
    if (commentBusy || updateBusy || uploadBusy || watcherBusy) return;
    onClose?.();
  }, [commentBusy, onClose, updateBusy, uploadBusy, watcherBusy]);

  const formattedCreated = formatDateTime(ticket?.createdAt);
  const formattedUpdated = formatDateTime(ticket?.updatedAt);
  const formattedSla = ticket?.sla?.breachAt
    ? formatDateTime(ticket.sla.breachAt)
    : "N/A";

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: (theme) => {
          const safeTop = `calc(${APP_BAR_HEIGHT}px + env(safe-area-inset-top, 0px))`;
          return {
            width: { xs: 360, sm: 400, md: 420 },
            bgcolor: "#111",
            top: safeTop,
            height: `calc(100% - ${safeTop})`,
            borderLeft: `1px solid ${theme.palette.divider}`,
            borderTop: "none",
          };
        },
      }}
    >
      <Box
        sx={{
          p: 2,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              {ticket?.title || "Support Ticket"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              ID: {ticketId || "N/A"}
            </Typography>
          </Box>
          <IconButton
            onClick={handleClose}
            aria-label="Close support ticket details"
          >
            <CloseIcon />
          </IconButton>
        </Stack>

        <Typography
          variant="body2"
          sx={{ whiteSpace: "pre-line", color: "text.secondary" }}
        >
          {ticket?.description || "No description provided."}
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip size="small" label={`Category: ${ticket?.category || "N/A"}`} />
          <Chip
            size="small"
            label={`Priority: ${ticket?.priority || "N/A"}`}
            color="default"
          />
          <Chip
            size="small"
            label={`Status: ${ticket?.status || "N/A"}`}
            color={ticket?.status === "open" ? "warning" : "default"}
          />
          {ticket?.sla?.breachAt ? (
            <Chip size="small" label={`SLA: ${formattedSla}`} color="error" />
          ) : null}
        </Stack>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ sm: "center" }}
        >
          <TextField
            select
            size="small"
            label="Status"
            value={ticket?.status || "open"}
            onChange={(event) =>
              handleFieldChange("status", event.target.value)
            }
            disabled={updateBusy}
            sx={{ minWidth: 180 }}
          >
            {STATUS_OPTIONS.map((status) => (
              <MenuItem key={status} value={status}>
                {status}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Priority"
            value={ticket?.priority || "normal"}
            onChange={(event) =>
              handleFieldChange("priority", event.target.value)
            }
            disabled={updateBusy}
            sx={{ minWidth: 180 }}
          >
            {PRIORITY_OPTIONS.map((priority) => (
              <MenuItem key={priority} value={priority}>
                {priority}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Divider light />

        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            component="label"
            startIcon={
              uploadBusy ? <CircularProgress size={16} /> : <UploadIcon />
            }
            variant="outlined"
            disabled={uploadBusy}
          >
            Upload
            <input hidden multiple type="file" onChange={handleUploadFiles} />
          </Button>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Attach screenshots, PDFs, or logs.
          </Typography>
        </Stack>

        <Box>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1 }}
          >
            <Typography variant="subtitle2">Attachments</Typography>
            {attachmentsLoading ? <CircularProgress size={16} /> : null}
          </Stack>
          {attachmentsError ? (
            <Typography variant="caption" color="error">
              {attachmentsError?.message || "Failed to load attachments."}
            </Typography>
          ) : null}
          {!attachmentsLoading && !attachments.length ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              No attachments yet.
            </Typography>
          ) : null}
          <Stack spacing={1} sx={{ mt: attachments.length ? 1 : 0 }}>
            {attachments.map((attachment) => (
              <Button
                key={attachment.id}
                component="a"
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                size="small"
                endIcon={<VisibilityIcon fontSize="small" />}
                sx={{ justifyContent: "flex-start" }}
              >
                {attachment.name || attachment.id}
              </Button>
            ))}
          </Stack>
        </Box>

        <Divider light />

        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2">Watchers</Typography>
          <Tooltip
            title={
              isWatching
                ? "You're watching this support ticket"
                : "Add me as a watcher"
            }
          >
            <span>
              <Button
                size="small"
                variant="contained"
                disabled={!currentUserId || isWatching || watcherBusy}
                onClick={handleAddWatcher}
                sx={{ bgcolor: "#4cbb17", "&:hover": { bgcolor: "#3aa40f" } }}
              >
                {isWatching ? "Watching" : watcherBusy ? "Adding..." : "Watch"}
              </Button>
            </span>
          </Tooltip>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {watchers.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              No watchers yet.
            </Typography>
          ) : (
            watchers.map((id) => {
              const info = watcherContacts[id] || {};
              const label = info.displayName || info.email || id;
              return <Chip key={id} size="small" label={label} />;
            })
          )}
        </Stack>

        <Divider light />

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Add Comment
          </Typography>
          <TextField
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            multiline
            minRows={2}
            fullWidth
            placeholder="Share updates or troubleshooting notes"
            disabled={commentBusy}
          />
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button
              variant="contained"
              onClick={handleCommentSubmit}
              disabled={commentBusy || !comment.trim()}
              sx={{ bgcolor: "#4cbb17", "&:hover": { bgcolor: "#3aa40f" } }}
            >
              {commentBusy ? "Posting..." : "Comment"}
            </Button>
            <Button
              onClick={handleClose}
              disabled={commentBusy || updateBusy || uploadBusy}
            >
              Close
            </Button>
          </Stack>
        </Box>

        <Divider light />

        <Box sx={{ mt: "auto" }}>
          <Typography
            variant="caption"
            sx={{ display: "block", color: "text.secondary" }}
          >
            Created: {formattedCreated}
          </Typography>
          <Typography
            variant="caption"
            sx={{ display: "block", color: "text.secondary" }}
          >
            Updated: {formattedUpdated}
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}
