// allow-color-literal-file

import { useMemo, useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
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

const TRIP_CATEGORIES = ["Point to Point, Round Trip", "Hourly Reservation"];

const VEHICLES = ["Limo Bus", "Rescue Squad", "Luxury Sprint", "LRP1-8"];

function generateNote(template, tripCategory, tripType, totalPassengers, vehicles, miscellaneous) {
  if (!template) return "";

  const lines = [];

  // Add trip category
  if (tripCategory) {
    lines.push(tripCategory);
  }

  // Add trip type
  if (tripType) {
    lines.push(tripType);
  } else {
    lines.push("(Enter Trip Type Here) Ex. Golf Trip");
  }

  // Add total passengers
  if (totalPassengers) {
    lines.push(totalPassengers);
  } else {
    lines.push("(Enter Total Number of Passengers Here)");
  }

  // Add vehicles
  if (vehicles && vehicles.length > 0) {
    const vehicleText = vehicles.join(", ");
    if (vehicles.length > 1) {
      lines.push(`(If more than 1 vehicle, Enter that here and which vehicle(s): ${vehicleText})`);
    } else {
      lines.push(vehicleText);
    }
  } else {
    lines.push("(If more than 1 vehicle, Enter that here and which vehicle(s))");
  }

  // Add miscellaneous
  if (miscellaneous) {
    lines.push(miscellaneous);
  } else {
    lines.push("(Any other Miscellaneous Service or Items, if nothing else, delete this line)");
  }

  // Add template content
  lines.push(template);

  return lines.join("\n");
}

export default function NotesList({ notes, loading, error }) {
  const { show } = useSnack();
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [tripCategory, setTripCategory] = useState("Point to Point, Round Trip");
  const [tripType, setTripType] = useState("");
  const [totalPassengers, setTotalPassengers] = useState("");
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [miscellaneous, setMiscellaneous] = useState("");
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
        tripCategory,
        tripType,
        totalPassengers,
        selectedVehicles,
        miscellaneous,
      );
      setGeneratedNote(note);
    } else {
      setGeneratedNote("");
    }
  }, [selectedTemplate, tripCategory, tripType, totalPassengers, selectedVehicles, miscellaneous]);

  const handleVehicleToggle = (vehicle) => {
    setSelectedVehicles((prev) => {
      if (prev.includes(vehicle)) {
        return prev.filter((v) => v !== vehicle);
      }
      return [...prev, vehicle];
    });
  };

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
                <FormControl fullWidth>
                  <InputLabel sx={{ color: (t) => t.palette.text.primary }}>
                    Trip Category
                  </InputLabel>
                  <Select
                    label="Trip Category"
                    value={tripCategory}
                    onChange={(event) => setTripCategory(event.target.value)}
                    sx={{
                      color: (t) => t.palette.text.primary,
                      bgcolor: (t) => t.palette.background.paper,
                    }}
                  >
                    {TRIP_CATEGORIES.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="Trip Type"
                  placeholder="e.g., Golf Trip"
                  value={tripType}
                  onChange={(event) => setTripType(event.target.value)}
                  fullWidth
                  helperText="Leave blank to show placeholder in note"
                  sx={{
                    bgcolor: (t) => t.palette.background.paper,
                  }}
                  InputProps={{ sx: { color: (t) => t.palette.text.primary } }}
                />

                <TextField
                  label="Total Passengers"
                  placeholder="e.g., 10 Passengers"
                  value={totalPassengers}
                  onChange={(event) => setTotalPassengers(event.target.value)}
                  fullWidth
                  helperText="Leave blank to show placeholder in note"
                  sx={{
                    bgcolor: (t) => t.palette.background.paper,
                  }}
                  InputProps={{ sx: { color: (t) => t.palette.text.primary } }}
                />

                <FormControl component="fieldset">
                  <FormLabel component="legend" sx={{ color: (t) => t.palette.text.primary, mb: 1 }}>
                    Select Vehicle(s)
                  </FormLabel>
                  <FormGroup>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap">
                      {VEHICLES.map((vehicle) => (
                        <FormControlLabel
                          key={vehicle}
                          control={
                            <Checkbox
                              checked={selectedVehicles.includes(vehicle)}
                              onChange={() => handleVehicleToggle(vehicle)}
                              sx={{
                                color: (t) => t.palette.text.secondary,
                                "&.Mui-checked": {
                                  color: (t) => t.palette.primary.main,
                                },
                              }}
                            />
                          }
                          label={vehicle}
                          sx={{ color: (t) => t.palette.text.primary }}
                        />
                      ))}
                    </Stack>
                  </FormGroup>
                </FormControl>

                <TextField
                  label="Miscellaneous Services or Items"
                  placeholder="e.g., Includes Wireless Tablet where you are your own DJ"
                  value={miscellaneous}
                  onChange={(event) => setMiscellaneous(event.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  helperText="Leave blank to show placeholder in note"
                  sx={{
                    bgcolor: (t) => t.palette.background.paper,
                  }}
                  InputProps={{ sx: { color: (t) => t.palette.text.primary } }}
                />

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
