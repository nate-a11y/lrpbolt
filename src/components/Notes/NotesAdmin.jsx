// allow-color-literal-file

import { useState, useMemo, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

import LoadingButtonLite from "@/components/inputs/LoadingButtonLite.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import {
  createNote,
  updateNote,
  deleteNote,
  restoreNote,
} from "@/services/notesService.js";
import logError from "@/utils/logError.js";
import { formatDateTime } from "@/utils/time.js";

const TRIP_TYPES = ["Point to Point", "Round Trip"];

function ensureString(value) {
  if (value == null) return "";
  return String(value);
}

function buildPayload(values) {
  return {
    title: ensureString(values.title),
    tripType: ensureString(values.tripType) || "Point to Point",
    vehicleType: ensureString(values.vehicleType),
    passengerCount: typeof values.passengerCount === "number"
      ? values.passengerCount
      : parseInt(values.passengerCount, 10) || 0,
    noteText: ensureString(values.noteText),
    isActive: values.isActive !== false,
  };
}

const DEFAULT_FORM = {
  title: "",
  tripType: "Point to Point",
  vehicleType: "",
  passengerCount: 0,
  noteText: "",
  isActive: true,
};

function matchesQuery(note, query) {
  if (!query) return true;
  const haystack = [
    note?.title,
    note?.tripType,
    note?.vehicleType,
    note?.noteText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export default function NotesAdmin({ notes, loading, error }) {
  const { show } = useSnack();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("create");
  const [formValues, setFormValues] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [pendingMap, setPendingMap] = useState({});
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortBy, setSortBy] = useState("updated");

  const rows = useMemo(() => (Array.isArray(notes) ? notes : []), [notes]);
  const hasRows = rows.length > 0;
  const showError = Boolean(error) && !loading;
  const showEmpty = !showError && !loading && !hasRows;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const filteredRows = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const list = rows.slice();

    const filtered = list.filter((row) => {
      if (!row) return false;
      return matchesQuery(row, q);
    });

    filtered.sort((a, b) => {
      if (sortBy === "title") {
        return ensureString(a?.title).localeCompare(ensureString(b?.title));
      }
      const aTs = a?.updatedAt?.seconds || 0;
      const bTs = b?.updatedAt?.seconds || 0;
      return bTs - aTs;
    });

    return filtered;
  }, [rows, debouncedQuery, sortBy]);

  const openCreate = useCallback(() => {
    setDialogMode("create");
    setFormValues(DEFAULT_FORM);
    setActiveId(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((row) => {
    if (!row) return;
    setDialogMode("edit");
    setActiveId(row.id || null);
    setFormValues({
      title: ensureString(row.title),
      tripType: ensureString(row.tripType) || "Point to Point",
      vehicleType: ensureString(row.vehicleType),
      passengerCount: typeof row.passengerCount === "number"
        ? row.passengerCount
        : parseInt(row.passengerCount, 10) || 0,
      noteText: ensureString(row.noteText),
      isActive: row.isActive !== false,
    });
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    if (saving) return;
    setDialogOpen(false);
    setActiveId(null);
  }, [saving]);

  const handleFieldChange = useCallback((field, value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault();
      const payload = buildPayload(formValues);
      try {
        setSaving(true);
        if (dialogMode === "edit" && activeId) {
          await updateNote(activeId, payload);
          show("Note updated.", "success");
        } else {
          await createNote(payload);
          show("Note created.", "success");
        }
        setDialogOpen(false);
        setActiveId(null);
      } catch (err) {
        logError(err, { where: "NotesAdmin.handleSubmit", activeId });
        show("Failed to save. Please try again.", "error");
      } finally {
        setSaving(false);
      }
    },
    [activeId, dialogMode, formValues, show],
  );

  const setRowPending = useCallback((id, value) => {
    setPendingMap((prev) => {
      const next = { ...prev };
      if (!id) return next;
      if (value) {
        next[id] = true;
      } else {
        delete next[id];
      }
      return next;
    });
  }, []);

  const handleToggleActive = useCallback(
    async (row, nextActive) => {
      if (!row?.id) return;
      setRowPending(row.id, true);
      try {
        await updateNote(row.id, { isActive: nextActive });
        show(
          nextActive ? "Marked as active." : "Marked as inactive.",
          "success",
        );
      } catch (err) {
        logError(err, {
          where: "NotesAdmin.handleToggleActive",
          id: row?.id,
        });
        show("Failed to update status.", "error");
      } finally {
        setRowPending(row.id, false);
      }
    },
    [setRowPending, show],
  );

  const handleDelete = useCallback(
    async (row) => {
      if (!row?.id) return;
      // eslint-disable-next-line no-alert
      const confirmed = window.confirm(
        "Delete this note? This cannot be undone.",
      );
      if (!confirmed) return;
      setRowPending(row.id, true);
      const snapshot = { ...row };
      try {
        await deleteNote(row.id);
        show(`Deleted "${row.title || "note"}".`, "info", {
          autoHideDuration: 6000,
          action: (
            <Button
              color="inherit"
              size="small"
              sx={{ fontWeight: 600 }}
              onClick={async () => {
                try {
                  await restoreNote(snapshot);
                  show("Undo complete.", "success");
                } catch (undoErr) {
                  logError(undoErr, {
                    where: "NotesAdmin.undoDelete",
                    id: snapshot.id,
                  });
                  show("Failed to undo delete.", "error");
                }
              }}
            >
              Undo
            </Button>
          ),
        });
      } catch (err) {
        logError(err, {
          where: "NotesAdmin.handleDelete",
          id: row.id,
        });
        show("Failed to delete note.", "error");
      } finally {
        setRowPending(row.id, false);
      }
    },
    [setRowPending, show],
  );

  return (
    <Box
      sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Notes — Admin
        </Typography>
        <Button
          variant="contained"
          onClick={openCreate}
          sx={{
            bgcolor: (t) => t.palette.primary.main,
            "&:hover": { bgcolor: "#3aa40f" },
          }}
        >
          New Note
        </Button>
      </Stack>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        sx={{ flexWrap: "wrap", gap: { xs: 1, md: 1.5 } }}
      >
        <TextField
          size="small"
          placeholder="Search notes by title, vehicle type, or content…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          fullWidth
          sx={{
            maxWidth: { md: 360 },
            bgcolor: (t) => t.palette.background.paper,
          }}
          InputProps={{ sx: { color: (t) => t.palette.text.primary } }}
          inputProps={{ "aria-label": "Search notes admin list" }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel sx={{ color: (t) => t.palette.text.primary }}>
            Sort
          </InputLabel>
          <Select
            label="Sort"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            sx={{
              color: (t) => t.palette.text.primary,
              bgcolor: (t) => t.palette.background.paper,
            }}
          >
            <MenuItem value="updated">Updated (newest)</MenuItem>
            <MenuItem value="title">Title (A–Z)</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {showError ? (
        <Box sx={{ p: 2 }}>
          <Stack
            spacing={1.5}
            sx={{
              bgcolor: "#1a0b0b",
              border: 1,
              borderColor: "divider",
              p: 2,
              borderRadius: 2,
            }}
          >
            <Typography variant="subtitle1" sx={{ color: "#ffb4b4" }}>
              Unable to load notes.
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Try refreshing the page. If the issue persists, check your Firestore access.
            </Typography>
            <Button
              onClick={() => window.location.reload()}
              variant="outlined"
              size="small"
              sx={{
                borderColor: (t) => t.palette.primary.main,
                color: "#b7ffb7",
                width: "fit-content",
              }}
            >
              Refresh
            </Button>
          </Stack>
        </Box>
      ) : null}

      {showEmpty ? (
        <Box sx={{ p: 2 }}>
          <Stack
            spacing={1.5}
            sx={{
              bgcolor: (t) => t.palette.background.paper,
              border: 1,
              borderColor: "divider",
              p: 2,
              borderRadius: 2,
            }}
          >
            <Typography variant="subtitle1" sx={{ color: "#b7ffb7" }}>
              No notes yet.
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Add reservation notes to provide quick reference templates for common scenarios.
            </Typography>
            <Button
              onClick={openCreate}
              variant="contained"
              sx={{
                bgcolor: (t) => t.palette.primary.main,
                "&:hover": { bgcolor: "#3aa40f" },
                width: "fit-content",
              }}
            >
              Add first note
            </Button>
          </Stack>
        </Box>
      ) : null}

      {!showError && !showEmpty ? (
        <Stack spacing={1.25} sx={{ width: "100%" }}>
          {loading && !filteredRows.length ? (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              Loading notes…
            </Typography>
          ) : null}

          {!loading && hasRows && !filteredRows.length ? (
            <Box
              sx={(t) => ({
                p: 2,
                borderRadius: 2,
                border: `1px solid ${t.palette.divider}`,
                bgcolor: t.palette.background.paper,
              })}
            >
              <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                No matches for your search.
              </Typography>
            </Box>
          ) : null}

          {filteredRows.map((row) => {
            const id = row?.id;
            const disabled = !!pendingMap[id];
            const updatedLabel = formatDateTime(row?.updatedAt);

            return (
              <Card
                key={id}
                variant="outlined"
                sx={(t) => ({
                  bgcolor: t.palette.background.paper,
                  borderColor: t.palette.divider,
                  borderRadius: 3,
                })}
              >
                <CardContent sx={{ pb: 1.5 }}>
                  <Stack spacing={1.25}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", sm: "center" }}
                    >
                      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 700 }}
                          noWrap
                        >
                          {row?.title || "Untitled"}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          Updated {updatedLabel}
                        </Typography>
                      </Stack>
                    </Stack>

                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      sx={{ flexWrap: "wrap", gap: 1 }}
                    >
                      <Chip
                        size="small"
                        label={row?.tripType || "Point to Point"}
                        sx={{
                          bgcolor: "#143d0a",
                          color: "#b7ffb7",
                          border: (t) => `1px solid ${t.palette.primary.main}`,
                          fontWeight: 600,
                        }}
                      />
                      {row?.vehicleType ? (
                        <Chip
                          size="small"
                          label={row.vehicleType}
                          sx={{
                            bgcolor: (t) => t.palette.info.dark,
                            color: (t) => t.palette.info.light,
                            border: (t) => `1px solid ${t.palette.info.main}`,
                            fontWeight: 600,
                          }}
                        />
                      ) : null}
                      {row?.passengerCount ? (
                        <Chip
                          size="small"
                          label={`${row.passengerCount} Passenger${row.passengerCount !== 1 ? "s" : ""}`}
                          sx={{
                            bgcolor: (t) => t.palette.warning.dark,
                            color: (t) => t.palette.warning.light,
                            border: (t) => `1px solid ${t.palette.warning.main}`,
                            fontWeight: 600,
                          }}
                        />
                      ) : null}
                    </Stack>

                    {row?.noteText ? (
                      <Box
                        sx={{
                          bgcolor: (t) => t.palette.action.hover,
                          p: 2,
                          borderRadius: 2,
                          border: 1,
                          borderColor: "divider",
                          maxHeight: 200,
                          overflow: "auto",
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            whiteSpace: "pre-wrap",
                            fontFamily: "monospace",
                            lineHeight: 1.6,
                          }}
                        >
                          {row.noteText}
                        </Typography>
                      </Box>
                    ) : null}
                  </Stack>
                </CardContent>
                <CardActions
                  sx={{
                    px: 2,
                    pb: 2,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Switch
                      size="small"
                      checked={row?.isActive !== false}
                      onChange={(event) =>
                        handleToggleActive(row, event.target.checked)
                      }
                      disabled={disabled}
                    />
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      {row?.isActive !== false ? "Active" : "Inactive"}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Edit">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => openEdit(row)}
                          disabled={disabled}
                          sx={{ color: (t) => t.palette.primary.main }}
                          aria-label={`Edit ${row?.title || "note"}`}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(row)}
                          disabled={disabled}
                          sx={{ color: "#ff6b6b" }}
                          aria-label={`Delete ${row?.title || "note"}`}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </CardActions>
              </Card>
            );
          })}
        </Stack>
      ) : null}

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        fullWidth
        maxWidth="md"
        component="form"
        onSubmit={handleSubmit}
        sx={{ "& .MuiPaper-root": { bgcolor: "background.paper" } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {dialogMode === "edit" ? "Edit Note" : "Create Note"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={formValues.title}
              onChange={(event) =>
                handleFieldChange("title", event.target.value)
              }
              required
              fullWidth
              helperText="e.g., 'Limo Bus Reservation'"
            />
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Trip Type</InputLabel>
                <Select
                  label="Trip Type"
                  value={formValues.tripType}
                  onChange={(event) =>
                    handleFieldChange("tripType", event.target.value)
                  }
                >
                  {TRIP_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Vehicle Type"
                value={formValues.vehicleType}
                onChange={(event) =>
                  handleFieldChange("vehicleType", event.target.value)
                }
                fullWidth
                helperText="e.g., 'Limo Bus', 'SUV'"
              />
              <TextField
                label="Passenger Count"
                type="number"
                value={formValues.passengerCount}
                onChange={(event) =>
                  handleFieldChange("passengerCount", event.target.value)
                }
                fullWidth
                inputProps={{ min: 0 }}
              />
            </Stack>
            <TextField
              label="Note Text"
              value={formValues.noteText}
              onChange={(event) =>
                handleFieldChange("noteText", event.target.value)
              }
              fullWidth
              multiline
              minRows={8}
              helperText="The full note template to copy and paste."
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Switch
                checked={formValues.isActive}
                onChange={(event) =>
                  handleFieldChange("isActive", event.target.checked)
                }
              />
              <Typography variant="body2">Active</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeDialog} disabled={saving}>
            Cancel
          </Button>
          <LoadingButtonLite
            type="submit"
            loading={saving}
            loadingText="Saving…"
            variant="contained"
            sx={{
              bgcolor: (t) => t.palette.primary.main,
              "&:hover": { bgcolor: "#3aa40f" },
            }}
          >
            {dialogMode === "edit" ? "Save Changes" : "Create"}
          </LoadingButtonLite>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

NotesAdmin.propTypes = {
  notes: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  error: PropTypes.any,
};
