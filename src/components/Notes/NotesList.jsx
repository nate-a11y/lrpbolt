// allow-color-literal-file

import { useMemo, useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import { formatDateTime } from "@/utils/time.js";

function ensureString(value) {
  if (value == null) return "";
  return String(value);
}

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

export default function NotesList({ notes, loading, error }) {
  const { show } = useSnack();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const hasNotes = notes.length > 0;
  const showError = Boolean(error) && !loading;
  const showEmpty = !showError && !loading && !hasNotes;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const filteredNotes = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return notes.filter((note) => {
      if (!note) return false;
      return matchesQuery(note, q);
    });
  }, [notes, debouncedQuery]);

  const handleCopy = async (noteText, title) => {
    try {
      await navigator.clipboard.writeText(noteText);
      show(`Copied "${title}" to clipboard`, "success");
    } catch (err) {
      show("Failed to copy note", "error");
    }
  };

  if (showError) {
    return (
      <Box sx={{ p: 2, color: (t) => t.palette.text.primary }}>
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
            If you have admin access, open the Admin tab to add the first note.
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
    );
  }

  if (showEmpty) {
    return (
      <Box sx={{ p: 2, color: (t) => t.palette.text.primary }}>
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
            Once admins add reservation notes, they'll show here for quick
            reference.
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Stack spacing={1.5} sx={{ mb: 0.5 }}>
        <TextField
          size="small"
          placeholder="Search notes by title, vehicle type, or content…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{
            maxWidth: { md: 640 },
            bgcolor: (t) => t.palette.background.paper,
          }}
          InputProps={{ sx: { color: (t) => t.palette.text.primary } }}
          inputProps={{ "aria-label": "Search notes" }}
        />
      </Stack>

      <Stack spacing={2.5}>
        {loading && !filteredNotes.length ? (
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Loading notes…
          </Typography>
        ) : null}

        {filteredNotes.map((note) => {
          const updatedLabel = formatDateTime(note?.updatedAt);
          const key = note?.id ?? `note-${note?.title}`;

          return (
            <Card
              key={key}
              variant="outlined"
              sx={{
                bgcolor: (t) => t.palette.background.paper,
                borderColor: (t) => t.palette.divider,
                borderRadius: 3,
              }}
            >
              <CardContent>
                <Stack spacing={2}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                  >
                    <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 700 }}
                      >
                        {note?.title || "Untitled"}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ opacity: 0.7 }}
                      >
                        Updated {updatedLabel}
                      </Typography>
                    </Stack>
                    <Tooltip title="Copy note to clipboard">
                      <IconButton
                        onClick={() => handleCopy(note?.noteText || "", note?.title || "note")}
                        size="small"
                        sx={{
                          color: (t) => t.palette.primary.main,
                          "&:hover": { bgcolor: "rgba(76, 175, 80, 0.08)" },
                        }}
                      >
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ flexWrap: "wrap", gap: 1 }}
                  >
                    <Chip
                      size="small"
                      label={note?.tripType || "Point to Point"}
                      sx={{
                        bgcolor: "#143d0a",
                        color: "#b7ffb7",
                        border: (t) => `1px solid ${t.palette.primary.main}`,
                        fontWeight: 600,
                      }}
                    />
                    {note?.vehicleType ? (
                      <Chip
                        size="small"
                        label={note.vehicleType}
                        sx={{
                          bgcolor: (t) => t.palette.info.dark,
                          color: (t) => t.palette.info.light,
                          border: (t) => `1px solid ${t.palette.info.main}`,
                          fontWeight: 600,
                        }}
                      />
                    ) : null}
                    {note?.passengerCount ? (
                      <Chip
                        size="small"
                        label={`${note.passengerCount} Passenger${note.passengerCount !== 1 ? "s" : ""}`}
                        sx={{
                          bgcolor: (t) => t.palette.warning.dark,
                          color: (t) => t.palette.warning.light,
                          border: (t) => `1px solid ${t.palette.warning.main}`,
                          fontWeight: 600,
                        }}
                      />
                    ) : null}
                  </Stack>

                  <Box
                    sx={{
                      bgcolor: (t) => t.palette.action.hover,
                      p: 2,
                      borderRadius: 2,
                      border: 1,
                      borderColor: "divider",
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
                      {note?.noteText || "No note content"}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          );
        })}

        {!filteredNotes.length && !loading ? (
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
      </Stack>
    </Box>
  );
}

NotesList.propTypes = {
  notes: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  error: PropTypes.any,
};
