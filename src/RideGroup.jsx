/* Proprietary and confidential. See LICENSE. */
// src/components/RideGroup.jsx
import React, { useState, useRef, useMemo } from "react";
import {
  Box,
  Typography,
  Card,
  Button,
  Paper,
  Divider,
  Stack,
  useTheme,
  Grid,
  Snackbar,
  Alert,
  CircularProgress,
  useMediaQuery,
  ButtonGroup,
  ToggleButton,
  Chip,
  Grow,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import NotesIcon from "@mui/icons-material/Notes";
import dayjs from "dayjs";
import { logError } from "./utils/logError";
import {
  fmtTime,
  fmtDurationHM,
  safe,
} from "./utils/rideFormatters";

const RideDetailRow = ({
  icon,
  label,
  preserveLine = false,
  highlightColor,
}) => {
  const [prefix, ...rest] = label.split(":");
  return (
    <Box display="flex" alignItems="flex-start" mb={0.5}>
      <Box sx={{ minWidth: "30px", pt: "2px" }}>{icon}</Box>
      <Typography
        sx={{
          whiteSpace: preserveLine ? "pre-line" : "normal",
          color: highlightColor || "inherit",
        }}
      >
        <strong>{prefix}:</strong>
        {rest.length > 0 ? rest.join(":") : ""}
      </Typography>
    </Box>
  );
};

function RideGroup({
  groupKey,
  rides,
  onClaim,
  showToast,
  selectedRides,
  onToggleSelect,
  onGroupToggle,
  onClearSelected,
}) {
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [vehicle, , date] = groupKey.split("___");
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const groupRef = useRef(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimingIds, setClaimingIds] = useState([]);
  const selectedInGroup = useMemo(
    () => rides.filter((r) => selectedRides.has(r.tripId)).map((r) => r.tripId),
    [rides, selectedRides],
  );
  const dayOfWeek = useMemo(() => dayjs(date).format("dddd"), [date]);
  const vehicleIcon = useMemo(() => {
    if (vehicle.startsWith("LRPSQD")) return "🚒";
    if (vehicle.startsWith("LRPSPR")) return "🚐";
    if (vehicle.startsWith("LRPSHU")) return "🚌";
    if (vehicle.startsWith("LRPBus")) return "🚌";
    return "🚗";
  }, [vehicle]);

  const handleToggle = (tripId) => onToggleSelect(tripId);

  const handleSelectAll = () => {
    const allIds = rides.map((r) => r.tripId);
    onGroupToggle(allIds);
  };

  const handleMultiClaim = async () => {
    setIsClaiming(true);
    setClaimingIds(selectedInGroup);
    try {
      const results = await Promise.allSettled(
        selectedInGroup.map((tripId) => onClaim(tripId)),
      );
      const failures = results.filter((r) => r.status !== "fulfilled");
      if (failures.length > 0) {
        showToast(
          `⚠️ ${failures.length} of ${selectedInGroup.length} rides failed to claim.`,
          "warning",
        );
      } else {
        showToast(
          `✅ Successfully claimed all ${selectedInGroup.length} rides!`,
          "success",
        );
      }
      onClearSelected(selectedInGroup);
    } catch (error) {
      logError(error, "RideGroup:multiClaim");
      showToast("❌ One or more rides failed to claim.", "error");
    } finally {
      setIsClaiming(false);
      setClaimingIds([]);
    }
  };

  const handleSingleClaim = async (tripId) => {
    setClaimingIds((prev) => [...prev, tripId]);
    try {
      await onClaim(tripId);
      onClearSelected([tripId]);
      showToast(`✅ Ride ${tripId} claimed!`, "success");
      groupRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      logError(error, "RideGroup:singleClaim");
      showToast("❌ Failed to claim ride.", "error");
    } finally {
      setClaimingIds((prev) => prev.filter((id) => id !== tripId));
    }
  };

  if (!rides.length) {
    return (
      <Paper variant="outlined" sx={{ p: 3, mb: 3, textAlign: "center" }}>
        <Typography variant="subtitle1" color="text.secondary">
          📭 No rides available in this group.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      ref={groupRef}
      sx={{
        p: 2,
        mb: 4,
        borderLeft: "6px solid #4cbb17",
        backgroundColor: theme.palette.mode === "dark" ? "#1e1e1e" : "#fefefe",
      }}
    >
      <Box
        sx={{
          background:
            theme.palette.mode === "dark"
              ? "linear-gradient(45deg, #1b5e20, #2e7d32)"
              : "linear-gradient(45deg, #e8f5e9, #c8e6c9)",
          borderRadius: 1,
          p: 1.5,
          mb: 2,
          boxShadow: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Typography variant="h6" fontWeight="bold">
          {vehicleIcon} {vehicle} – 📅 {dayOfWeek} ({date})
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="body2" fontWeight="bold">
            Total: {rides.length} rides
          </Typography>
          <Button
            variant="contained"
            size="small"
            color="primary"
            onClick={handleSelectAll}
            aria-label="Select all rides in group"
            disabled={isClaiming}
          >
            {selectedInGroup.length === rides.length
              ? "Deselect All"
              : "Select All"}
          </Button>
        </Box>
      </Box>
      <Divider
        sx={{
          mb: 2,
          borderColor: theme.palette.mode === "dark" ? "#4cbb17" : "#81c784",
          opacity: 0.75,
          borderBottomWidth: "2px",
        }}
      />

      <Stack spacing={3}>
        {rides.map((ride) => {
          const isSelected = selectedInGroup.includes(ride.tripId);
          const isLoading = claimingIds.includes(ride.tripId);

          return (
            <Grow in key={ride.tripId} timeout={300}>
              <Card
                elevation={2}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: isSelected
                    ? theme.palette.mode === "dark"
                      ? "#324d28"
                      : "#e8f5e9"
                    : theme.palette.background.paper,
                  border: isSelected ? `2px solid ${theme.palette.primary.main}` : "1px solid",
                  borderColor: isSelected ? theme.palette.primary.main : theme.palette.divider,
                  transition: "background 0.3s ease, transform 0.3s ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: 3,
                  },
                }}
              >
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Chip
                      label={`ID ${safe(ride.tripId)}`}
                      size="small"
                      sx={{
                        backgroundColor:
                          theme.palette.mode === "dark" ? "#6a1b9a" : "#ba68c8",
                        color: theme.palette.common.white,
                        fontWeight: "bold",
                        mb: 1,
                      }}
                    />
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <AccessTimeIcon
                        fontSize="small"
                        sx={{ color: theme.palette.text.secondary }}
                      />
                      <Typography variant="body2" color="text.primary">
                        {fmtTime(ride.pickupTime)} • {fmtDurationHM(
                          ride.rideDuration,
                        )}
                      </Typography>
                    </Box>

                    <Box mt={1}>
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        mb={0.5}
                      >
                        Details
                      </Typography>
                      <RideDetailRow
                        icon={<SwapHorizIcon fontSize="small" />}
                        label={`Type: ${safe(ride.rideType)}`}
                        highlightColor={
                          ride.rideType === "Hourly" ? "#4cbb17" : undefined
                        }
                      />
                      {ride.rideNotes && (
                        <RideDetailRow
                          icon={<NotesIcon fontSize="small" />}
                          label={`Notes: ${ride.rideNotes}`}
                          preserveLine
                        />
                      )}
                    </Box>
                  </Grid>

                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      justifyContent={isMobile ? "flex-start" : "flex-end"}
                      flexWrap="wrap"
                    >
                      <ButtonGroup variant="outlined" size="small">
                        <ToggleButton
                          value="select"
                          selected={isSelected}
                          onChange={() => handleToggle(ride.tripId)}
                          sx={{ textTransform: "none" }}
                        >
                          {isSelected ? "Selected" : "Select"}
                        </ToggleButton>
                        <Button
                          color="success"
                          variant="contained"
                          onClick={() => handleSingleClaim(ride.tripId)}
                          disabled={isClaiming || isLoading}
                          sx={{ textTransform: "none", fontWeight: "bold" }}
                        >
                          {isLoading ? <CircularProgress size={16} /> : "Claim"}
                        </Button>
                      </ButtonGroup>
                    </Stack>
                  </Grid>
                </Grid>
              </Card>
            </Grow>
          );
        })}
      </Stack>

      {selectedInGroup.length > 0 && (
        <Box textAlign="center" mt={3}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleMultiClaim}
            disabled={isClaiming}
          >
            🛒 CLAIM {selectedInGroup.length} SELECTED RIDES
          </Button>
        </Box>
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          onClose={() => setSnack({ ...snack, open: false })}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
}

export default React.memo(RideGroup);
