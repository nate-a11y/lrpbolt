// allow-color-literal-file

import { useMemo, useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";

const TRIP_TYPES = ["One-Way", "Round Trip (Point-to-Point)", "Hourly"];

function generateNote(template, tripType, passengerCount, vehicleType) {
  if (!template) return "";

  const lines = [];

  // Add vehicle type line if available
  if (vehicleType) {
    lines.push(vehicleType);
    lines.push("");
  }

  // Add trip type
  lines.push(tripType);

  // Add passenger count
  const passengerLabel = passengerCount === 1 ? "Passenger" : "Passengers";
  lines.push(`${passengerCount} ${passengerLabel}`);
  lines.push("");

  // Add template content
  lines.push(template);

  return lines.join("\n");
}

export default function NotesList({ notes, loading, error }) {
  const { show } = useSnack();
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [tripType, setTripType] = useState("One-Way");
  const [passengerCount, setPassengerCount] = useState(1);
  const [generatedNote, setGeneratedNote] = useState("");

  const hasNotes = notes.length > 0;
  const showError = Boolean(error) && !loading;
  const showEmpty = !showError && !loading && !hasNotes;

  const activeNotes = useMemo(() => {
    return notes.filter((note) => note && note.isActive !== false);
  }, [notes]);

  const selectedTemplate = useMemo(() => {
    return activeNotes.find((note) => note.id === selectedTemplateId);
  }, [activeNotes, selectedTemplateId]);

  useEffect(() => {
    if (selectedTemplate) {
      const note = generateNote(
        selectedTemplate.noteTemplate,
        tripType,
        passengerCount,
        selectedTemplate.vehicleType,
      );
      setGeneratedNote(note);
    } else {
      setGeneratedNote("");
    }
  }, [selectedTemplate, tripType, passengerCount]);

  const handleCopy = async () => {
    if (!generatedNote) {
      show("No note to copy", "warning");
      return;
    }
    try {
      await navigator.clipboard.writeText(generatedNote);
      show("Copied note to clipboard", "success");
    } catch {
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
            Once admins add reservation notes, they&apos;ll show here for quick
            reference.
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 3 }}
    >
      <Card
        variant="outlined"
        sx={{
          bgcolor: (t) => t.palette.background.paper,
          borderColor: (t) => t.palette.divider,
          borderRadius: 3,
        }}
      >
        <CardContent>
          <Stack spacing={3}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Generate Note
            </Typography>

            <FormControl fullWidth>
              <InputLabel sx={{ color: (t) => t.palette.text.primary }}>
                Select Template
              </InputLabel>
              <Select
                label="Select Template"
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                sx={{
                  color: (t) => t.palette.text.primary,
                  bgcolor: (t) => t.palette.background.paper,
                }}
              >
                <MenuItem value="">
                  <em>Choose a template...</em>
                </MenuItem>
                {activeNotes.map((note) => (
                  <MenuItem key={note.id} value={note.id}>
                    {note.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedTemplateId && (
              <>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: (t) => t.palette.text.primary }}>
                      Trip Type
                    </InputLabel>
                    <Select
                      label="Trip Type"
                      value={tripType}
                      onChange={(event) => setTripType(event.target.value)}
                      sx={{
                        color: (t) => t.palette.text.primary,
                        bgcolor: (t) => t.palette.background.paper,
                      }}
                    >
                      {TRIP_TYPES.map((type) => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    label="Passenger Count"
                    type="number"
                    value={passengerCount}
                    onChange={(event) =>
                      setPassengerCount(parseInt(event.target.value, 10) || 1)
                    }
                    fullWidth
                    inputProps={{ min: 1 }}
                    sx={{
                      bgcolor: (t) => t.palette.background.paper,
                    }}
                    InputProps={{ sx: { color: (t) => t.palette.text.primary } }}
                  />
                </Stack>

                <Box
                  sx={{
                    bgcolor: (t) => t.palette.action.hover,
                    p: 3,
                    borderRadius: 2,
                    border: 1,
                    borderColor: "divider",
                    position: "relative",
                  }}
                >
                  <Stack spacing={2}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 700, opacity: 0.7 }}
                      >
                        Generated Note
                      </Typography>
                      <Tooltip title="Copy to clipboard">
                        <IconButton
                          onClick={handleCopy}
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
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: "pre-wrap",
                        fontFamily: "monospace",
                        lineHeight: 1.6,
                      }}
                    >
                      {generatedNote || "No note generated"}
                    </Typography>
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

NotesList.propTypes = {
  notes: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  error: PropTypes.any,
};
