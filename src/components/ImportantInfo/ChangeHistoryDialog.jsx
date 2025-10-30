import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Box,
  Chip,
  Divider,
  CircularProgress,
  Alert,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { getAuditLog } from "@/services/importantInfoAuditLog.js";
import logError from "@/utils/logError.js";

dayjs.extend(relativeTime);

// Action colors for visual distinction (using theme-based colors)
const getActionColors = (theme) => ({
  create: {
    bg: theme.palette.primary.dark,
    border: theme.palette.primary.main,
    text: alpha(theme.palette.primary.main, 0.6),
  },
  update: {
    bg: alpha(theme.palette.info.dark, 0.5),
    border: theme.palette.info.main,
    text: theme.palette.info.light,
  },
  delete: {
    bg: alpha(theme.palette.error.dark, 0.5),
    border: theme.palette.error.main,
    text: theme.palette.error.light,
  },
  restore: {
    bg: alpha(theme.palette.warning.dark, 0.5),
    border: theme.palette.warning.main,
    text: alpha(theme.palette.warning.main, 0.4),
  },
});

function getActionColor(action, theme) {
  const colors = getActionColors(theme);
  return (
    colors[action] || {
      bg: alpha(theme.palette.grey[800], 0.5),
      border: theme.palette.grey[600],
      text: theme.palette.grey[400],
    }
  );
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "Unknown time";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return dayjs(date).fromNow();
}

function formatFullTimestamp(timestamp) {
  if (!timestamp) return "Unknown time";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return dayjs(date).format("MMM D, YYYY h:mm A");
}

function renderChanges(changes) {
  if (!changes || Object.keys(changes).length === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: 1, ml: 2 }}>
      {Object.entries(changes).map(([field, change]) => (
        <Box key={field} sx={{ mb: 0.5 }}>
          <Typography
            variant="caption"
            component="div"
            sx={{
              fontFamily: "monospace",
              color: (t) => t.palette.text.secondary,
            }}
          >
            <Box component="strong">{field}:</Box>{" "}
            {change.from !== undefined && change.from !== null ? (
              <Box
                component="span"
                sx={{ textDecoration: "line-through", opacity: 0.7 }}
              >
                {typeof change.from === "object"
                  ? JSON.stringify(change.from)
                  : String(change.from)}
              </Box>
            ) : (
              <Box component="span" sx={{ opacity: 0.5 }}>
                (empty)
              </Box>
            )}{" "}
            →{" "}
            {change.to !== undefined && change.to !== null ? (
              <Box component="span" sx={{ color: (t) => t.palette.success.light }}>
                {typeof change.to === "object"
                  ? JSON.stringify(change.to)
                  : String(change.to)}
              </Box>
            ) : (
              <Box component="span" sx={{ opacity: 0.5 }}>
                (empty)
              </Box>
            )}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function ChangeHistoryDialog({
  open,
  onClose,
  itemId,
  itemTitle,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);

  const fetchHistory = useCallback(async () => {
    if (!itemId) return;

    setLoading(true);
    setError("");
    try {
      const entries = await getAuditLog(itemId);
      setHistory(entries);
    } catch (err) {
      const message = err?.message || "Failed to load change history.";
      setError(message);
      logError(err, { where: "ChangeHistoryDialog.fetchHistory", itemId });
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    if (open && itemId) {
      fetchHistory();
    }
  }, [open, itemId, fetchHistory]);

  const handleClose = useCallback(() => {
    if (loading) return;
    onClose();
  }, [loading, onClose]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="md"
      sx={{ "& .MuiPaper-root": { bgcolor: "background.paper" } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        Change History
        {itemTitle && (
          <Typography
            variant="body2"
            sx={{ mt: 0.5, opacity: 0.8, fontWeight: 400 }}
          >
            {itemTitle}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box
            sx={{
              py: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress color="inherit" />
          </Box>
        ) : error ? (
          <Alert
            severity="error"
            sx={{
              bgcolor: (t) => alpha(t.palette.error.dark, 0.9),
              color: (t) => alpha(t.palette.error.main, 0.5),
            }}
          >
            {error}
          </Alert>
        ) : history.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              No change history available.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {history.map((entry, index) => {
              const timestamp = formatTimestamp(entry.timestamp);
              const fullTimestamp = formatFullTimestamp(entry.timestamp);
              const user =
                entry.user?.displayName || entry.user?.email || "Unknown User";
              const userRole = entry.user?.role || "unknown";

              return (
                <Box key={entry.id || index}>
                  <Stack spacing={1}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      flexWrap="wrap"
                    >
                      <Chip
                        size="small"
                        label={entry.action}
                        sx={(t) => {
                          const actionColor = getActionColor(entry.action, t);
                          return {
                            fontWeight: 600,
                            bgcolor: actionColor.bg,
                            color: actionColor.text,
                            border: `1px solid ${actionColor.border}`,
                            textTransform: "capitalize",
                          };
                        }}
                      />
                      <Typography variant="body2">
                        by <strong>{user}</strong>
                        {userRole !== "unknown" && (
                          <Chip
                            size="small"
                            label={userRole}
                            sx={{
                              ml: 0.5,
                              fontSize: "0.7rem",
                              height: 20,
                            }}
                          />
                        )}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ ml: "auto", opacity: 0.7 }}
                        title={fullTimestamp}
                      >
                        {timestamp}
                      </Typography>
                    </Stack>

                    {entry.metadata && (
                      <Typography
                        variant="caption"
                        sx={{ opacity: 0.7, ml: 1 }}
                      >
                        {entry.metadata.title && `"${entry.metadata.title}"`}
                        {entry.metadata.category &&
                          ` (${entry.metadata.category})`}
                      </Typography>
                    )}

                    {entry.changes && renderChanges(entry.changes)}
                  </Stack>

                  {index < history.length - 1 && (
                    <Divider
                      sx={{ borderColor: (t) => t.palette.divider, mt: 2 }}
                    />
                  )}
                </Box>
              );
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Close
        </Button>
        <Button
          onClick={fetchHistory}
          disabled={loading}
          variant="outlined"
          sx={{
            borderColor: (t) => t.palette.primary.main,
            color: (t) => alpha(t.palette.primary.main, 0.6),
          }}
        >
          Refresh
        </Button>
      </DialogActions>
    </Dialog>
  );
}

ChangeHistoryDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  itemId: PropTypes.string,
  itemTitle: PropTypes.string,
};
