/* Proprietary and confidential. See LICENSE. */
import React, { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardActions,
  Stack,
  Typography,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Collapse,
} from "@mui/material";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import DirectionsCar from "@mui/icons-material/DirectionsCar";
import CheckCircle from "@mui/icons-material/CheckCircle";

import { durationHM, formatRange, tsToDayjs } from "@/utils/claimTime";

export default function RideCard({
  ride,
  selected,
  onToggleSelect,
  onClaim,
  claiming,
  highlight = false,
}) {
  const [open, setOpen] = useState(false);
  const start = tsToDayjs(ride?.startTime);
  const meta = useMemo(
    () => ({
      range: formatRange(ride?.startTime, ride?.endTime),
      duration: durationHM(ride?.startTime, ride?.endTime),
      date: start ? start.format("ddd, MMM D") : "N/A",
    }),
    [ride, start],
  );

  const claimed = Boolean(ride?.claimedBy);

  return (
    <Card
      sx={{
        overflow: "hidden",
        transition: "transform 120ms ease, box-shadow 200ms ease",
        borderColor: selected ? "primary.main" : "rgba(255,255,255,0.06)",
        boxShadow: selected ? "0 0 0 2px rgba(76,187,23,0.6)" : "none",
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
          {meta.date} • {meta.range}
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
              <InfoOutlined />
            </IconButton>
          </Tooltip>
        </Stack>

        <Button
          variant="contained"
          color="primary"
          size="small"
          disabled={claimed || claiming}
          onClick={onClaim}
          aria-label="Claim ride"
        >
          {claiming ? "Claiming…" : claimed ? "Claimed" : "Claim"}
        </Button>
      </CardActions>
    </Card>
  );
}
