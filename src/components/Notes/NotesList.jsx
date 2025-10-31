import { useMemo, useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  alpha,
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

const ORDER_TYPES = [
  "21st Birthday",
  "Airport",
  "Airport Drop Off",
  "Airport Pick Up",
  "Anniversary",
  "Bachelor/Bachelorette",
  "Bar",
  "Bar/Bat Mitzvah",
  "Baseball",
  "Basketball",
  "Birthday",
  "Brew Tour",
  "Bridal Party",
  "Bride/Groom",
  "Business Trip",
  "Concert",
  "Corporate",
  "Corporate Event",
  "Day Tour",
  "Family Reunion",
  "Field Trip",
  "Football",
  "Funeral",
  "Golf",
  "Graduation",
  "Hockey",
  "Holiday",
  "Kids Birthday",
  "Leisure",
  "Medical",
  "Night Out",
  "Other",
  "Personal Trip",
  "Point-to-Point",
  "Prom/Homecoming",
  "Quinceanera",
  "School",
  "School Fundraiser",
  "Seaport",
  "Special Occasion",
  "Sporting Event",
  "Sweet 16",
  "Train Station",
  "Wedding",
  "Wine Tour",
  "Custom", // This will trigger the custom text field
];

const VEHICLES = [
  "Limo Bus",
  "Rescue Squad",
  "Luxury Sprinter",
  "Shuttle",
  "LRP1",
  "LRP2",
  "LRP3",
  "LRP4",
  "LRP5",
  "LRP6",
  "LRP7",
  "LRP8",
];

function generateNote(
  template,
  tripType,
  orderType,
  totalPassengers,
  vehicles,
  miscellaneous,
) {
  if (!template) return "";

  const lines = [];

  // Add trip type
  if (tripType) {
    lines.push(tripType);
  }

  // Add order type
  if (orderType) {
    lines.push(orderType);
  } else {
    lines.push("(Enter Order Type Here) Ex. Golf Trip");
  }

  // Add total passengers
  if (totalPassengers) {
    lines.push(totalPassengers);
  } else {
    lines.push("(Enter Total Number of Passengers Here)");
  }

  // Add vehicles - just the names comma-separated
  if (vehicles && vehicles.length > 0) {
    lines.push(vehicles.join(", "));
  } else {
    lines.push(
      "(If more than 1 vehicle, Enter that here and which vehicle(s))",
    );
  }

  // Add miscellaneous only if provided
  if (miscellaneous) {
    lines.push(miscellaneous);
  }

  // Add blank line before template
  lines.push("");

  // Add template content
  lines.push(template);

  return lines.join("\n");
}

export default function NotesList({ notes, loading, error }) {
  const { show } = useSnack();
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [tripType, setTripType] = useState("One-Way");
  const [orderType, setOrderType] = useState("");
  const [customOrderType, setCustomOrderType] = useState("");
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
      // Use custom order type if "Custom" is selected, otherwise use the selected orderType
      const finalOrderType =
        orderType === "Custom" ? customOrderType : orderType;
      const note = generateNote(
        selectedTemplate.noteTemplate,
        tripType,
        finalOrderType,
        totalPassengers,
        selectedVehicles,
        miscellaneous,
      );
      setGeneratedNote(note);
    } else {
      setGeneratedNote("");
    }
  }, [
    selectedTemplate,
    tripType,
    orderType,
    customOrderType,
    totalPassengers,
    selectedVehicles,
    miscellaneous,
  ]);

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
            bgcolor: (t) => t.palette.error.dark,
            border: 1,
            borderColor: "divider",
            p: 2,
            borderRadius: 2,
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{ color: (t) => t.palette.error.light }}
          >
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
              color: (t) => t.palette.success.light,
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
          <Typography
            variant="subtitle1"
            sx={{ color: (t) => t.palette.success.light }}
          >
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

                <FormControl fullWidth>
                  <InputLabel sx={{ color: (t) => t.palette.text.primary }}>
                    Order Type
                  </InputLabel>
                  <Select
                    label="Order Type"
                    value={orderType}
                    onChange={(event) => setOrderType(event.target.value)}
                    sx={{
                      color: (t) => t.palette.text.primary,
                      bgcolor: (t) => t.palette.background.paper,
                    }}
                  >
                    <MenuItem value="">
                      <em>Select an order type...</em>
                    </MenuItem>
                    {ORDER_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {orderType === "Custom" && (
                  <TextField
                    label="Custom Order Type"
                    placeholder="e.g., Golf Trip"
                    value={customOrderType}
                    onChange={(event) => setCustomOrderType(event.target.value)}
                    fullWidth
                    helperText="Enter your custom order type"
                    sx={{
                      bgcolor: (t) => t.palette.background.paper,
                    }}
                    InputProps={{
                      sx: { color: (t) => t.palette.text.primary },
                    }}
                  />
                )}

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

                <FormControl fullWidth>
                  <InputLabel sx={{ color: (t) => t.palette.text.primary }}>
                    Select Vehicle(s)
                  </InputLabel>
                  <Select
                    multiple
                    label="Select Vehicle(s)"
                    value={selectedVehicles}
                    onChange={(event) =>
                      setSelectedVehicles(event.target.value)
                    }
                    sx={{
                      color: (t) => t.palette.text.primary,
                      bgcolor: (t) => t.palette.background.paper,
                    }}
                    renderValue={(selected) => selected.join(", ")}
                  >
                    {VEHICLES.map((vehicle) => (
                      <MenuItem key={vehicle} value={vehicle}>
                        {vehicle}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="Miscellaneous Services or Items"
                  placeholder="e.g., Includes Wireless Tablet where you are your own DJ"
                  value={miscellaneous}
                  onChange={(event) => setMiscellaneous(event.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  helperText="Optional - leave blank if not needed"
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
                            "&:hover": {
                              bgcolor: (t) =>
                                alpha(t.palette.primary.main, 0.08),
                            },
                          }}
                        >
                          <ContentCopyIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    <Typography
                      variant="body1"
                      sx={{
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.8,
                        letterSpacing: "0.01em",
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
