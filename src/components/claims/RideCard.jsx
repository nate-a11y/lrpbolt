/* Proprietary and confidential. See LICENSE. */
// allow-color-literal-file

import React, { useMemo } from "react";
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Stack,
  Typography,
  Tooltip,
  Grow,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import DirectionsCar from "@mui/icons-material/DirectionsCar";
import CheckCircle from "@mui/icons-material/CheckCircle";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import BoltIcon from "@mui/icons-material/Bolt";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

// Build blurb and details for ExpandableDetails component
function buildDetails(ride = {}) {
  // Candidate lines: prefer summary/description/notes; also allow pickup/dropoff/type
  const candidates = [
    ride.summary,
    ride.description,
    ride.notes,
    ride.itinerary,
    ride.details,
    ride.pickup && ride.dropoff
      ? `${ride.pickup} — ${ride.dropoff} • ${ride.rideType || "As Directed"}`
      : null,
    ride.pickup,
    ride.dropoff,
  ].filter(Boolean);

  // Normalize + dedupe (case/space-insensitive)
  const seen = new Set();
  const lines = [];
  for (const raw of candidates) {
    const pieces = String(raw)
      .split(/\r?\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of pieces) {
      const key = p.replace(/\s+/g, " ").toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        lines.push(p);
      }
    }
  }

  const allText = lines.join("\n");
  if (allText.length <= 100) {
    return { blurb: allText, details: "" };
  }

  // Split into blurb (first line) and details (rest)
  return {
    blurb: lines[0] || "No details provided.",
    details: lines.slice(1).join("\n"),
  };
}

import {
  resolvePickupTime,
  resolveDropoffTime,
  resolveRideDuration,
} from "@/columns/rideColumns.jsx";
import { tsToDayjs, formatHMFromMinutes } from "@/utils/timeUtils";
import { normalizeStatus } from "@/utils/statusUtils.js";
import ExpandableDetails from "@/components/ExpandableDetails.jsx";

const formatRideWindow = (startAt, endAt) => {
  if (!startAt && !endAt) return "N/A";
  if (startAt && endAt) {
    const sameDay = endAt.isSame(startAt, "day");
    return sameDay
      ? `${startAt.format("ddd, MMM D • h:mm A")} – ${endAt.format("h:mm A")}`
      : `${startAt.format("ddd, MMM D • h:mm A")} – ${endAt.format(
          "ddd, MMM D • h:mm A",
        )}`;
  }
  const single = startAt || endAt;
  return single ? single.format("ddd, MMM D • h:mm A") : "N/A";
};

export function isClaimable(ride) {
  const status = normalizeStatus(ride?.status);
  const okStatus =
    !status ||
    status === "unclaimed" ||
    status === "open" ||
    status === "available";
  const claimed = Boolean(ride?.claimed) || Boolean(ride?.claimedBy);
  return okStatus && !claimed;
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
}) {
  const pickupSource = useMemo(() => resolvePickupTime(null, ride), [ride]);
  const dropoffSource = useMemo(() => resolveDropoffTime(null, ride), [ride]);
  const rawDuration = useMemo(() => resolveRideDuration(null, ride), [ride]);

  const startAt = useMemo(() => tsToDayjs(pickupSource), [pickupSource]);
  const dropoffAt = useMemo(() => tsToDayjs(dropoffSource), [dropoffSource]);

  const endAt = useMemo(() => {
    if (dropoffAt) return dropoffAt;
    if (
      startAt &&
      typeof rawDuration === "number" &&
      Number.isFinite(rawDuration) &&
      rawDuration >= 0
    ) {
      return startAt.add(rawDuration, "minute");
    }
    return null;
  }, [dropoffAt, rawDuration, startAt]);

  const resolvedDurationMinutes = useMemo(() => {
    if (typeof rawDuration === "number" && Number.isFinite(rawDuration)) {
      return rawDuration;
    }
    if (startAt && endAt) {
      const diff = endAt.diff(startAt, "minute");
      return Number.isFinite(diff) && diff >= 0 ? diff : null;
    }
    return null;
  }, [endAt, rawDuration, startAt]);

  const rangeLabel = useMemo(
    () => formatRideWindow(startAt, endAt),
    [endAt, startAt],
  );

  const durationLabel = useMemo(
    () => formatHMFromMinutes(resolvedDurationMinutes),
    [resolvedDurationMinutes],
  );

  const claimed = Boolean(ride?.claimed || ride?.claimedBy);
  const claimable = isClaimable(ride);
  const claimButtonLabel = claiming
    ? "Claiming…"
    : claimable
      ? "Claim"
      : "Unavailable";
  const normalizedStatus = useMemo(
    () => normalizeStatus(ride?.status),
    [ride?.status],
  );
  const claimDisabledReason = useMemo(() => {
    if (claimable) return "";
    if (ride?.claimedBy) {
      return `Already claimed by ${ride.claimedBy}`;
    }
    if (normalizedStatus === "queued") {
      return "Queued — will open automatically";
    }
    if (normalizedStatus === "open") {
      return "Unavailable to claim";
    }
    return normalizedStatus
      ? `Status: ${normalizedStatus}`
      : "Unavailable to claim";
  }, [claimable, normalizedStatus, ride?.claimedBy]);

  const { blurb, details } = useMemo(
    () => buildDetails({ ...ride, notes }),
    [ride, notes],
  );

  return (
    <Grow in timeout={220}>
      <Card
        sx={{
          position: "relative",
          mx: { xs: 1, sm: 1.5 },
          my: 1.25,
          borderRadius: 4,
          overflow: "visible", // ⬅️ allow content/hover lift to render freely
          zIndex: 2, // keep surface above decorative backgrounds
          background: "transparent",
          boxShadow: selected
            ? "0 18px 34px rgba(76,187,23,0.28)"
            : "0 14px 26px rgba(0,0,0,0.45)",
          transition:
            "transform 180ms ease, box-shadow 220ms ease, border-color 180ms ease",
          willChange: "transform",
          "&:hover": {
            transform: "translateY(-3px) translateZ(0)",
            boxShadow: "0 18px 36px rgba(0,0,0,0.55)",
          },
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            borderRadius: 16,
            padding: "1px",
            pointerEvents: "none",
            background: (t) =>
              `linear-gradient(90deg, ${alpha(t.palette.primary.main, 0.35)}, ${alpha(
                t.palette.primary.main,
                0,
              )} 60%)`,
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          },
        }}
        aria-pressed={selected}
      >
        {/* Inner surface keeps rounding/gradient/border; outer Card stays unclipped */}
        <Box
          sx={{
            p: { xs: 1.75, sm: 2 },
            borderRadius: 4,
            background: (t) =>
              `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.14)}, ${alpha(
                t.palette.common.black,
                0.95,
              )})`,
            border: "1px solid",
            borderColor: (t) =>
              selected
                ? t.palette.primary.main
                : alpha(t.palette.common.white, 0.08),
            ...(highlight
              ? {
                  borderColor: (t) => t.palette.primary.light,
                  boxShadow: (t) =>
                    `0 0 0 1px ${alpha(t.palette.primary.main, 0.75)}, 0 26px 48px ${alpha(
                      t.palette.primary.main,
                      0.2,
                    )}`,
                }
              : {}),
          }}
        >
          <CardContent
            sx={{
              p: 0,
              display: "flex",
              flexDirection: "column",
              gap: 1.75,
            }}
          >
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
              sx={{ rowGap: 1.25 }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  backgroundColor: (t) => alpha(t.palette.primary.main, 0.16),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "primary.main",
                  flexShrink: 0,
                }}
              >
                <DirectionsCar fontSize="small" />
              </Box>
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography
                  variant="overline"
                  sx={{
                    letterSpacing: 1.1,
                    color: "rgba(255,255,255,0.64)",
                    textTransform: "uppercase",
                  }}
                >
                  {ride?.type || "Ride"}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {ride?.vehicleLabel || ride?.vehicle || "Vehicle"}
                </Typography>
              </Box>
              {claimed && (
                <Chip
                  color="success"
                  icon={<CheckCircle />}
                  label="Claimed"
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              )}
            </Stack>

            <Stack
              direction="row"
              spacing={1.25}
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
              sx={{ rowGap: 1 }}
            >
              <ScheduleRoundedIcon
                sx={{ color: "primary.main" }}
                fontSize="small"
              />
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 900,
                  color: "primary.main",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {rangeLabel}
              </Typography>
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              sx={{ rowGap: 1 }}
            >
              <Chip
                icon={<AccessTimeIcon fontSize="small" />}
                label={durationLabel}
                size="small"
                sx={{
                  bgcolor: (t) => alpha(t.palette.common.white, 0.06),
                  color: "common.white",
                  fontWeight: 600,
                  ".MuiChip-icon": { color: "primary.main" },
                }}
              />
              <Chip
                label={`ID ${ride?.idShort || ride?.id || "N/A"}`}
                size="small"
                sx={{
                  bgcolor: (t) => alpha(t.palette.common.white, 0.06),
                  color: "common.white",
                }}
              />
              {!!normalizedStatus && (
                <Chip
                  size="small"
                  label={normalizedStatus.toUpperCase()}
                  sx={{
                    bgcolor: (t) =>
                      normalizedStatus === "open"
                        ? alpha(t.palette.primary.main, 0.16)
                        : alpha(t.palette.common.white, 0.06),
                    color:
                      normalizedStatus === "open"
                        ? "primary.main"
                        : "rgba(255,255,255,0.7)",
                    border: (t) =>
                      `1px solid ${
                        normalizedStatus === "open"
                          ? t.palette.primary.main
                          : alpha(t.palette.common.white, 0.16)
                      }`,
                    fontWeight: 700,
                  }}
                />
              )}
              {ride?.scanStatus && (
                <Chip
                  label={ride.scanStatus}
                  size="small"
                  color={
                    ride.scanStatus === "Not Scanned" ? "warning" : "success"
                  }
                  sx={{ fontWeight: 600 }}
                />
              )}
            </Stack>

            <Box
              sx={{
                borderRadius: 2,
                bgcolor: (t) => alpha(t.palette.common.white, 0.06),
                border: (t) => `1px solid ${t.palette.divider}`,
                px: 2,
                py: 1.25,
              }}
            >
              <ExpandableDetails
                id={ride?.id}
                blurb={blurb}
                details={details}
                remember={false}
              />
            </Box>
          </CardContent>

          <CardActions
            sx={{
              mt: 2,
              px: 0,
              pt: 1.5,
              borderTop: (t) => `1px solid ${t.palette.divider}`,
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "stretch", sm: "center" },
              justifyContent: "space-between",
              gap: 1.25,
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              sx={{
                width: "100%",
                rowGap: 1,
                maxWidth: { xs: "100%", sm: "60%" },
              }}
            >
              <Button
                variant={selected ? "contained" : "outlined"}
                color="primary"
                size="small"
                onClick={onToggleSelect}
                aria-label={selected ? "Deselect ride" : "Select ride"}
                sx={{ flexGrow: 1, maxWidth: { xs: "100%", sm: "auto" } }}
              >
                {selected ? "Selected" : "Select"}
              </Button>
            </Stack>

            <Tooltip
              title={claimDisabledReason}
              disableHoverListener={claimable}
              placement="top"
            >
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  size="medium"
                  disabled={claiming || !claimable}
                  onClick={onClaim}
                  aria-label="Claim ride"
                  startIcon={<BoltIcon fontSize="small" />}
                  sx={{
                    borderRadius: 9999,
                    px: 3,
                    py: 1,
                    alignSelf: { xs: "stretch", sm: "center" },
                    boxShadow: "0 0 0 0 rgba(0,0,0,0)",
                    color: "#060606",
                    fontWeight: 700,
                    "&:hover": { filter: "brightness(1.08)" },
                    "&.Mui-disabled": {
                      color: "rgba(255,255,255,0.4)",
                      backgroundColor: (t) =>
                        alpha(t.palette.common.white, 0.08),
                    },
                  }}
                >
                  {claimButtonLabel}
                </Button>
              </span>
            </Tooltip>
          </CardActions>
        </Box>
      </Card>
    </Grow>
  );
}
