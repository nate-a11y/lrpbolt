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
import dayjsLib from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";

dayjsLib.extend(utc);
dayjsLib.extend(tz);

const dayjs = dayjsLib;

const USER_TZ = dayjs.tz.guess();

function safeToDayjs(ts) {
  try {
    return ts?.toDate ? dayjs(ts.toDate()) : null;
  } catch {
    return null;
  }
}

function formatRange(startTs, endTs) {
  const s = safeToDayjs(startTs);
  const e = safeToDayjs(endTs);
  if (!s) return "N/A";
  if (!e || e.isBefore(s)) return s.tz(USER_TZ).format("ddd, MMM D • h:mm A");
  const sameDay =
    s.tz(USER_TZ).format("YYYY-MM-DD") === e.tz(USER_TZ).format("YYYY-MM-DD");
  return sameDay
    ? `${s.tz(USER_TZ).format("ddd, MMM D • h:mm A")} – ${e
        .tz(USER_TZ)
        .format("h:mm A")}`
    : `${s.tz(USER_TZ).format("ddd, MMM D • h:mm A")} – ${e
        .tz(USER_TZ)
        .format("ddd, MMM D • h:mm A")}`;
}

function formatDuration(startTs, endTs) {
  const s = safeToDayjs(startTs);
  const e = safeToDayjs(endTs);
  if (!s || !e) return "N/A";
  const ms = e.diff(s);
  if (!Number.isFinite(ms) || ms < 0) return "N/A";
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h ? `${h}h ${mm}m` : `${mm}m`;
}

export function isClaimable(ride) {
  const okStatus =
    !ride?.status || ride.status === "unclaimed" || ride.status === "open";
  return okStatus && !ride?.claimed && !ride?.claimedBy;
}

export function getRideNotes(src) {
  if (!src) return "";
  const {
    notes,
    note,
    comments,
    comment,
    adminNotes,
    rideNotes,
    pickupNotes,
    dropoffNotes,
  } = src;
  const parts = [
    notes,
    note,
    comments,
    comment,
    adminNotes,
    rideNotes,
    pickupNotes,
    dropoffNotes,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim())
    .filter(Boolean);
  return Array.from(new Set(parts)).join(" • ");
}

export default function RideCard({
  ride,
  selected,
  onToggleSelect,
  onClaim,
  claiming,
  highlight = false,
  notes = "",
  notesOpen = false,
  onToggleNotes,
}) {
  const [open, setOpen] = useState(false);
  const startSrc = ride?.pickupTime || ride?.startTime;
  const endSrc = ride?.dropoffTime || ride?.endTime;
  const rangeLabel = useMemo(
    () => formatRange(startSrc, endSrc),
    [endSrc, startSrc],
  );
  const durationLabel = useMemo(
    () => formatDuration(startSrc, endSrc),
    [endSrc, startSrc],
  );

  const claimed = Boolean(ride?.claimed || ride?.claimedBy);
  const claimable = isClaimable(ride);
  const claimButtonLabel = claiming
    ? "Claiming…"
    : claimable
      ? "Claim"
      : "Unavailable";

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
          sx={{ color: "primary.main", fontWeight: 900 }}
        >
          {rangeLabel}
        </Typography>

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ flexWrap: "wrap" }}
        >
          <Chip label={`ID ${ride?.idShort || ride?.id || ""}`} />
          <Chip label={durationLabel} />
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
          disabled={claiming || !claimable}
          onClick={onClaim}
          aria-label="Claim ride"
          sx={{
            backgroundColor: "primary.main",
            color: "#000",
            fontWeight: 700,
            "&:hover": { filter: "brightness(1.05)" },
          }}
        >
          {claimButtonLabel}
        </Button>
      </CardActions>
    </Card>
  );
}
