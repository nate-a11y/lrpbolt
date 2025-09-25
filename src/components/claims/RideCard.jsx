/* Proprietary and confidential. See LICENSE. */
import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Collapse,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DirectionsCar from "@mui/icons-material/DirectionsCar";
import CheckCircle from "@mui/icons-material/CheckCircle";

import { tsToDayjs } from "@/utils/claimTime";

export default function RideCard({
  ride,
  selected,
  onToggleSelect,
  onClaim,
  claiming,
  highlight = false,
  claimDisabled = false,
  notes = "",
  notesOpen = false,
  onToggleNotes,
}) {
  const [open, setOpen] = useState(false);
  const startSrc = ride?.startTime || ride?.pickupTime;
  const endSrc = ride?.endTime || ride?.dropoffTime;
  const meta = useMemo(
    () => ({
      range: formatRange(startSrc, endSrc, ride?.rideDuration),
      duration: formatDuration(startSrc, endSrc, ride?.rideDuration),
      startLabel: formatStart(startSrc),
    }),
    [endSrc, ride, startSrc],
  );

  const claimed = Boolean(ride?.claimedBy);
  const unavailable =
    claimed || (ride?.status && ride.status !== "unclaimed") || false;

  return (
    <Card
      sx={{
        overflow: "hidden",
        transition: "transform 120ms ease, box-shadow 200ms ease",
        borderColor: selected ? "primary.main" : "divider",
        borderWidth: 1,
        borderStyle: "solid",
        boxShadow: selected
          ? "0 0 0 2px rgba(76,187,23,0.6)"
          : "0 1px 3px rgba(0,0,0,0.18)",
        "&:hover": { transform: "translateY(-2px)" },
        ...(highlight
          ? {
              boxShadow: "0 0 0 4px rgba(76,187,23,0.7)",
              animation: "fadeGlow 1.4s ease 1",
              "@keyframes fadeGlow": {
                from: { boxShadow: "0 0 0 8px rgba(76,187,23,0.9)" },
                to: { boxShadow: "none" },
              },
            }
          : {}),
      }}
      aria-pressed={selected}
    >
      <CardContent sx={{ pb: 1.25 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mb: 0.5, flexWrap: "wrap" }}
        >
          <DirectionsCar fontSize="small" />
          <Typography fontWeight={800}>
            {ride?.vehicleLabel || ride?.vehicle || "Vehicle"}
          </Typography>
          <Chip label={ride?.type || "Ride"} variant="outlined" />
          {claimed && (
            <Chip color="success" icon={<CheckCircle />} label="Claimed" />
          )}
        </Stack>

        <Typography
          variant="h6"
          sx={{ color: "primary.main", fontWeight: 900, mb: 0.5 }}
        >
          {meta.startLabel} • {meta.range}
        </Typography>

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ flexWrap: "wrap" }}
        >
          <Chip label={`ID ${ride?.idShort || ride?.id || ""}`} />
          <Chip label={meta.duration} />
          {ride?.scanStatus && (
            <Chip
              label={ride.scanStatus}
              color={ride.scanStatus === "Not Scanned" ? "warning" : "success"}
            />
          )}
        </Stack>

        {notes && (
          <Box sx={{ mt: 0.5 }}>
            <Box
              onClick={() => onToggleNotes?.()}
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1,
                cursor: "pointer",
                "&:hover": { opacity: 0.9 },
              }}
              aria-label="Show ride notes"
            >
              <InfoOutlinedIcon
                fontSize="small"
                sx={{ mt: "2px", color: "primary.main" }}
              />
              <Typography
                variant="body2"
                sx={{
                  display: "-webkit-box",
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  color: "text.secondary",
                }}
              >
                {notes}
              </Typography>
            </Box>
            <Collapse in={notesOpen} unmountOnExit>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", mt: 0.5 }}
              >
                {notes}
              </Typography>
            </Collapse>
          </Box>
        )}

        <Collapse in={open} unmountOnExit>
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.85 }}>
            {ride?.pickup ? `Pickup: ${ride.pickup}` : null}
            {ride?.dropoff ? ` • Dropoff: ${ride.dropoff}` : null}
          </Typography>
        </Collapse>
      </CardContent>

      <CardActions
        sx={{ pt: 0.5, pb: 1.25, px: 2, justifyContent: "space-between" }}
      >
        <Stack direction="row" spacing={1}>
          <Button
            variant={selected ? "contained" : "outlined"}
            size="small"
            onClick={onToggleSelect}
            aria-label={selected ? "Deselect ride" : "Select ride"}
          >
            {selected ? "Selected" : "Select"}
          </Button>
          <Tooltip title="Details">
            <IconButton
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle details"
            >
              <InfoOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Button
          variant="contained"
          color="primary"
          size="small"
          disabled={claimDisabled || unavailable || claiming}
          onClick={onClaim}
          aria-label="Claim ride"
          sx={{
            backgroundColor: "primary.main",
            color: "#000",
            fontWeight: 700,
            "&:hover": { filter: "brightness(1.05)" },
          }}
        >
          {claiming ? "Claiming…" : unavailable ? "Claimed" : "Claim"}
        </Button>
      </CardActions>
    </Card>
  );
}

function formatStart(ts) {
  const start = tsToDayjs(ts);
  if (!start) return "N/A";
  return start.format("ddd, MMM D • h:mm A");
}

function formatRange(startTs, endTs, durationMins) {
  const start = tsToDayjs(startTs);
  let end = tsToDayjs(endTs);
  if (!end && start && Number.isFinite(durationMins)) {
    end = start.add(durationMins, "minute");
  }
  if (!start || !end) return "N/A";
  return `${start.format("h:mm A")} – ${end.format("h:mm A")}`;
}

function formatDuration(startTs, endTs, durationMins) {
  const start = tsToDayjs(startTs);
  let end = tsToDayjs(endTs);
  if (!start && !end) {
    if (!Number.isFinite(durationMins)) return "N/A";
    const mins = Math.max(0, Math.round(durationMins));
    return humanizeMinutes(mins);
  }
  if (!end && start && Number.isFinite(durationMins)) {
    end = start.add(durationMins, "minute");
  }
  if (!start || !end) return "N/A";
  const diff = Math.max(0, end.diff(start, "minute"));
  if (!Number.isFinite(diff)) return "N/A";
  return humanizeMinutes(diff);
}

function humanizeMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes < 0) return "N/A";
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}
