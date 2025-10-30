import { useMemo } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Card,
  CardActions,
  CardContent,
  Checkbox,
  Chip,
  Grow,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import DirectionsCar from "@mui/icons-material/DirectionsCar";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";

import ExpandableDetails from "@/components/ExpandableDetails.jsx";
import {
  resolvePickupTime,
  resolveRideDuration,
  resolveTripId,
  resolveVehicle,
  resolveRideNotes,
  resolveRideType,
  resolveStatus,
  resolveCreatedAt,
  resolveClaimedBy,
  resolveClaimedAt,
} from "@/columns/rideColumns.jsx";
import { vfTime, vfDurationHM, vfText } from "@/utils/vf.js";

/**
 * BaseRideCard - A beautiful card component for displaying ride information
 * Similar to the ImportantInfoList card format
 */
export default function BaseRideCard({
  ride,
  selected = false,
  onSelect,
  actions = null,
  statusChip = null,
  highlight = false,
  showCheckbox = false,
}) {
  // Resolve ride fields
  const tripId = useMemo(() => resolveTripId(null, ride), [ride]);
  const pickupSource = useMemo(() => resolvePickupTime(null, ride), [ride]);
  const rawDuration = useMemo(() => resolveRideDuration(null, ride), [ride]);
  const vehicle = useMemo(() => resolveVehicle(null, ride), [ride]);
  const rideType = useMemo(() => resolveRideType(null, ride), [ride]);
  const notes = useMemo(() => resolveRideNotes(null, ride), [ride]);
  const status = useMemo(() => resolveStatus(null, ride), [ride]);
  const createdAt = useMemo(() => resolveCreatedAt(null, ride), [ride]);
  const claimedBy = useMemo(() => resolveClaimedBy(null, ride), [ride]);
  const claimedAt = useMemo(() => resolveClaimedAt(null, ride), [ride]);

  // Format times
  const pickupLabel = useMemo(() => vfTime(pickupSource), [pickupSource]);
  const durationLabel = useMemo(() => vfDurationHM(rawDuration), [rawDuration]);
  const createdLabel = useMemo(() => vfTime(createdAt), [createdAt]);
  const claimedAtLabel = useMemo(() => vfTime(claimedAt), [claimedAt]);

  // Build blurb and details for ExpandableDetails
  const { blurb, details } = useMemo(() => {
    const parts = [];
    if (ride?.pickup) parts.push(`Pickup: ${ride.pickup}`);
    if (ride?.dropoff) parts.push(`Dropoff: ${ride.dropoff}`);
    if (notes) parts.push(notes);

    const allText = parts.join(" • ");
    if (allText.length <= 120) {
      return { blurb: allText, details: "" };
    }

    return {
      blurb: allText.substring(0, 120) + "...",
      details: allText,
    };
  }, [ride, notes]);

  const handleCheckboxChange = (event) => {
    event.stopPropagation();
    onSelect?.();
  };

  return (
    <Grow in timeout={220}>
      <Card
        sx={{
          position: "relative",
          borderRadius: 3,
          bgcolor: (t) => t.palette.background.paper,
          borderColor: (t) =>
            selected
              ? t.palette.primary.main
              : highlight
                ? t.palette.primary.light
                : t.palette.divider,
          border: 1,
          boxShadow: (t) =>
            selected
              ? `0 8px 24px ${alpha(t.palette.primary.main, 0.25)}`
              : `0 4px 12px ${alpha(t.palette.common.black, 0.15)}`,
          transition:
            "transform 180ms ease, box-shadow 220ms ease, border-color 180ms ease",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: (t) =>
              `0 8px 24px ${alpha(t.palette.common.black, 0.25)}`,
          },
        }}
      >
        <CardContent sx={{ pb: 1.5 }}>
          <Stack spacing={1.5}>
            {/* Header with vehicle and checkbox */}
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1.5} alignItems="center" flex={1}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
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
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 700,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {vfText(vehicle, null, null, null, "Vehicle")}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    {vfText(rideType, null, null, null, "Ride")} • ID:{" "}
                    {vfText(tripId, null, null, null, "N/A")}
                  </Typography>
                </Box>
              </Stack>
              {showCheckbox && (
                <Checkbox
                  checked={selected}
                  onChange={handleCheckboxChange}
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    color: (t) => alpha(t.palette.primary.main, 0.5),
                    "&.Mui-checked": {
                      color: (t) => t.palette.primary.main,
                    },
                  }}
                />
              )}
            </Stack>

            {/* Pickup time */}
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                border: (t) =>
                  `1px solid ${alpha(t.palette.primary.main, 0.3)}`,
                borderRadius: 2,
                px: 1.5,
                py: 1,
              }}
            >
              <ScheduleRoundedIcon
                sx={{ color: "primary.main" }}
                fontSize="small"
              />
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  color: "primary.main",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {pickupLabel}
              </Typography>
            </Stack>

            {/* Chips row */}
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
                  color: "text.primary",
                  fontWeight: 600,
                  ".MuiChip-icon": { color: "primary.main" },
                }}
              />
              {status && (
                <Chip
                  label={status.toUpperCase()}
                  size="small"
                  sx={{
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                    color: "primary.main",
                    border: (t) => `1px solid ${t.palette.primary.main}`,
                    fontWeight: 600,
                  }}
                />
              )}
              {createdAt && (
                <Chip
                  label={`Created: ${createdLabel}`}
                  size="small"
                  sx={{
                    bgcolor: (t) => alpha(t.palette.common.white, 0.06),
                    color: "text.secondary",
                  }}
                />
              )}
              {statusChip}
            </Stack>

            {/* Notes/Details with ExpandableDetails */}
            {(blurb || details) && (
              <Box
                sx={{
                  bgcolor: (t) => alpha(t.palette.common.white, 0.04),
                  border: (t) => `1px solid ${t.palette.divider}`,
                  borderRadius: 2,
                  px: 2,
                  py: 1.5,
                }}
              >
                <ExpandableDetails
                  id={ride?.id || tripId}
                  blurb={blurb}
                  details={details}
                  remember={false}
                />
              </Box>
            )}

            {/* Claimed info */}
            {claimedBy && (
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Claimed by {vfText(claimedBy, null, null, null, "Unknown")}
                {claimedAt && ` • ${claimedAtLabel}`}
              </Typography>
            )}
          </Stack>
        </CardContent>

        {/* Actions */}
        {actions && (
          <CardActions
            sx={{
              px: 2,
              pb: 2,
              pt: 0,
              borderTop: (t) => `1px solid ${t.palette.divider}`,
              justifyContent: "flex-end",
            }}
          >
            {actions}
          </CardActions>
        )}
      </Card>
    </Grow>
  );
}

BaseRideCard.propTypes = {
  ride: PropTypes.object.isRequired,
  selected: PropTypes.bool,
  onSelect: PropTypes.func,
  actions: PropTypes.node,
  statusChip: PropTypes.node,
  highlight: PropTypes.bool,
  showCheckbox: PropTypes.bool,
};
