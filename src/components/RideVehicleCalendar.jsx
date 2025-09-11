/* Proprietary and confidential. See LICENSE. */
/* global events, rideEvents, data */
import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  Box,
  Card,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import TodayIcon from "@mui/icons-material/Today";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DownloadIcon from "@mui/icons-material/Download";
import ShareIcon from "@mui/icons-material/Share";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import {
  normalizeEvent,
  buildVehicleMeta,
  packLanes,
  toZ,
} from "@/utils/scheduleNormalize.js";
import { exportRidesCsv } from "@/utils/scheduleUtils.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const LRP = { green: "#4cbb17", black: "#060606", card: "#0b0b0b" };
const TIMELINE_HOURS = 24;
const NOW_MARKER_WIDTH = 2;

function toStartOfDay(input, tz) {
  const ref = input ? toZ(input, tz) : dayjs().tz(tz || dayjs.tz.guess());
  return (ref || dayjs().tz(tz || dayjs.tz.guess())).startOf("day");
}

export default function RideVehicleCalendar({
  date,
  vehicles = [],
  rides = [],
  tz,
  onAddToCalendar,
  onOpenRide,
  onRefresh,
}) {
  const isMobile = useMediaQuery("(max-width:900px)");
  const timezoneGuess = useMemo(() => tz || dayjs.tz.guess(), [tz]);

  const [activeDay, setActiveDay] = useState(() =>
    toStartOfDay(date, timezoneGuess),
  );
  useEffect(() => {
    setActiveDay(toStartOfDay(date, timezoneGuess));
  }, [date, timezoneGuess]);

  const [vehicleFilter, setVehicleFilter] = useState("ALL");

  const _sourceArray =
    Array.isArray(rides) && rides.length
      ? rides
      : typeof events !== "undefined" && Array.isArray(events) && events.length
        ? events
        : typeof rideEvents !== "undefined" &&
            Array.isArray(rideEvents) &&
            rideEvents.length
          ? rideEvents
          : typeof data !== "undefined" && Array.isArray(data) && data.length
            ? data
            : [];

  const tzLocal = timezoneGuess;
  const dayStart = (activeDay || dayjs().tz(tzLocal)).startOf("day");
  const dayEnd = dayStart.add(1, "day");

  const normalized = (_sourceArray || [])
    .map((raw) => normalizeEvent(raw, tzLocal))
    .filter(
      (ev) => ev && ev.end.isAfter(dayStart) && ev.start.isBefore(dayEnd),
    );

  const vehicleMeta = buildVehicleMeta(vehicles || [], normalized);
  const vehicleIdsAll = Array.from(vehicleMeta.keys());

  const visibleVehicleIds =
    vehicleFilter === "ALL" || !vehicleMeta.has(vehicleFilter)
      ? vehicleIdsAll
      : [vehicleFilter];

  const stats = {
    rides: normalized.length,
    vehicles: new Set(normalized.map((e) => e.vehicleId)).size,
    overlaps: 0,
    tightGaps: 0,
  };

  const scrollRef = useRef(null);

  const scrollToNow = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const start = dayStart.valueOf();
    const end = dayEnd.valueOf();
    const nowMs = dayjs().tz(timezoneGuess).valueOf();
    const clamped = Math.min(Math.max(nowMs, start), end);
    const pct = (clamped - start) / (end - start);
    const x = pct * container.scrollWidth - container.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, x), behavior: "smooth" });
  }, [dayStart, dayEnd, timezoneGuess]);

  const shiftDay = (delta) =>
    setActiveDay((d) => d.add(delta, "day").startOf("day"));

  const hours = useMemo(() => {
    const arr = [];
    for (let i = 0; i <= TIMELINE_HOURS; i += 1)
      arr.push(dayStart.add(i, "hour"));
    return arr;
  }, [dayStart]);

  const baseWidth = useMemo(() => {
    const px = isMobile ? 64 : 80;
    return Math.round(px * TIMELINE_HOURS);
  }, [isMobile]);

  function handleExportCsv() {
    exportRidesCsv({
      rides: normalized,
      tz: timezoneGuess,
      filename: `lrp-rides-${activeDay.format("YYYY-MM-DD")}.csv`,
    });
  }

  if (import.meta.env.DEV && _sourceArray?.length && !normalized.length) {
    console.table(_sourceArray.slice(0, 6));
  }

  return (
    <Stack spacing={1.5} sx={{ color: "#fff" }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Ride & Vehicle Calendar
        </Typography>
        <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
          <Tooltip title="Previous day">
            <IconButton
              size="small"
              onClick={() => shiftDay(-1)}
              aria-label="Previous day"
            >
              <ArrowBackIosNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Chip
            size="small"
            color="success"
            icon={<TodayIcon />}
            onClick={() => setActiveDay(toStartOfDay(undefined, timezoneGuess))}
            label={activeDay.format("ddd, MMM D")}
            sx={{
              bgcolor: LRP.card,
              border: "1px solid rgba(255,255,255,0.12)",
              "& .MuiChip-icon": { color: LRP.green },
            }}
          />
          <Tooltip title="Next day">
            <IconButton
              size="small"
              onClick={() => shiftDay(1)}
              aria-label="Next day"
            >
              <ArrowForwardIosIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <span>
              <IconButton
                size="small"
                onClick={onRefresh || undefined}
                aria-label="Refresh"
                disabled={!onRefresh}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Filters / Stats */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1 }}>
        <FormControl size="small">
          <Select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            displayEmpty
            sx={{
              minWidth: 180,
              bgcolor: LRP.card,
              color: "#fff",
              borderRadius: 2,
              "& fieldset": { borderColor: "rgba(255,255,255,0.16)" },
            }}
            inputProps={{
              "aria-label": "Filter Vehicles",
              startAdornment: (
                <InputAdornment position="start">
                  <AccessTimeIcon sx={{ mr: 0.5, color: LRP.green }} />
                </InputAdornment>
              ),
            }}
          >
            <MenuItem value="ALL">All Vehicles</MenuItem>
            {vehicleIdsAll.map((id) => {
              const meta = vehicleMeta.get(id);
              return (
                <MenuItem key={id} value={id}>
                  {meta?.shortLabel || meta?.label || id}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>

        <Chip
          size="small"
          label={`${stats.rides} Rides • ${stats.vehicles} Vehicles • 0 Tight Gaps • 0 Overlaps`}
          sx={{
            bgcolor: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        />

        <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
          <Tooltip title="Scroll to Now">
            <IconButton
              size="small"
              onClick={scrollToNow}
              aria-label="Scroll to now"
            >
              <AccessTimeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export CSV">
            <IconButton
              size="small"
              onClick={handleExportCsv}
              aria-label="Export CSV"
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Add to Calendar">
            <span>
              <IconButton
                size="small"
                onClick={() =>
                  onAddToCalendar &&
                  onAddToCalendar({ day: activeDay, rides: normalized })
                }
                aria-label="Add to Calendar"
                disabled={!onAddToCalendar}
              >
                <ShareIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Timeline */}
      <Card
        elevation={0}
        sx={{
          bgcolor: LRP.card,
          borderRadius: 3,
          border: "1px solid rgba(255,255,255,0.12)",
          overflow: "hidden",
        }}
      >
        {/* Sticky hour ruler */}
        <Box
          sx={{
            px: 1,
            py: 0.5,
            position: "sticky",
            top: 0,
            zIndex: 2,
            bgcolor: LRP.card,
          }}
        >
          <Box
            sx={{
              overflowX: "auto",
              overflowY: "hidden",
              WebkitOverflowScrolling: "touch",
            }}
            ref={scrollRef}
          >
            <Box sx={{ position: "relative", minWidth: baseWidth }}>
              <Box
                sx={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: `repeat(${TIMELINE_HOURS}, 1fr)`,
                  gap: 0,
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {hours.map((h, i) => (
                  <Box
                    key={i}
                    sx={{
                      height: 24,
                      borderLeft:
                        i === 0 ? "none" : "1px dashed rgba(255,255,255,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      px: 0.5,
                      whiteSpace: "nowrap",
                      fontSize: 12,
                      color: "rgba(255,255,255,0.72)",
                    }}
                  >
                    {h.format("ha")}
                  </Box>
                ))}
              </Box>

              {/* NOW marker */}
              {dayjs().tz(timezoneGuess).isAfter(dayStart) &&
                dayjs().tz(timezoneGuess).isBefore(dayEnd) && (
                  <Box
                    sx={{
                      position: "absolute",
                      left: `${((dayjs().tz(timezoneGuess).valueOf() - dayStart.valueOf()) / (dayEnd.valueOf() - dayStart.valueOf())) * 100}%`,
                      top: 0,
                      bottom: 0,
                      width: NOW_MARKER_WIDTH,
                      transform: `translateX(-${NOW_MARKER_WIDTH / 2}px)`,
                      bgcolor: LRP.green,
                      opacity: 0.9,
                      borderRadius: 1,
                    }}
                  />
                )}
            </Box>
          </Box>
        </Box>

        <Divider sx={{ opacity: 0.12 }} />

        {/* Vehicle lanes */}
        <Box
          sx={{
            overflowX: "auto",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            maxHeight: isMobile ? 520 : 720,
          }}
          ref={scrollRef}
        >
          <Box sx={{ position: "relative", minWidth: baseWidth, p: 1 }}>
            {visibleVehicleIds.map((vid) => {
              const meta = vehicleMeta.get(vid);
              const items = normalized
                .filter((e) => e.vehicleId === vid)
                .sort((a, b) => a.start - b.start);
              const lanes = packLanes(items);

              return (
                <Box key={vid} sx={{ mb: 2.5 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ mb: 0.5 }}
                  >
                    <Chip
                      size="small"
                      label={meta?.shortLabel || meta?.label || vid}
                      sx={{
                        bgcolor: "#111",
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: "#fff",
                      }}
                    />
                    <Chip
                      size="small"
                      label={`${items.length} rides`}
                      sx={{ bgcolor: "rgba(255,255,255,0.08)" }}
                    />
                  </Stack>

                  {/* each lane becomes its own row to prevent visual overlap */}
                  <Stack spacing={0.75}>
                    {lanes.map((lane, i) => (
                      <Box key={i} sx={{ position: "relative", height: 28 }}>
                        {lane.map((ev) => {
                          const s = Math.max(
                            ev.start.valueOf(),
                            dayStart.valueOf(),
                          );
                          const e = Math.min(
                            ev.end.valueOf(),
                            dayEnd.valueOf(),
                          );
                          const pctStart =
                            ((s - dayStart.valueOf()) /
                              (dayEnd.valueOf() - dayStart.valueOf())) *
                            100;
                          const pctWidth = Math.max(
                            1.5,
                            ((e - s) /
                              (dayEnd.valueOf() - dayStart.valueOf())) *
                              100,
                          );
                          const label = `${ev.title}${ev.driverName ? ` • ${ev.driverName}` : ""}`;

                          return (
                            <Tooltip
                              key={ev.id}
                              title={
                                <Stack spacing={0.25}>
                                  <Typography
                                    variant="caption"
                                    sx={{ fontWeight: 700 }}
                                  >
                                    {label}
                                  </Typography>
                                  <Typography variant="caption">
                                    {ev.start.tz(tzLocal).format("h:mm a")} –{" "}
                                    {ev.end.tz(tzLocal).format("h:mm a")}
                                  </Typography>
                                </Stack>
                              }
                            >
                              <Box
                                role="button"
                                tabIndex={0}
                                onClick={() => onOpenRide && onOpenRide(ev)}
                                onKeyDown={(e) =>
                                  e.key === "Enter" &&
                                  onOpenRide &&
                                  onOpenRide(ev)
                                }
                                sx={{
                                  position: "absolute",
                                  left: `${pctStart}%`,
                                  width: `${pctWidth}%`,
                                  height: 24,
                                  bgcolor: "rgba(76,187,23,0.18)",
                                  border: "1px solid #4cbb17",
                                  borderRadius: 1.5,
                                  display: "flex",
                                  alignItems: "center",
                                  px: 1,
                                  overflow: "hidden",
                                  whiteSpace: "nowrap",
                                  textOverflow: "ellipsis",
                                  fontSize: 12,
                                  color: "#fff",
                                  "&:hover": { boxShadow: "0 0 0 1px #4cbb17" },
                                  "&:focus-visible": {
                                    boxShadow: "0 0 0 2px #4cbb17",
                                  },
                                }}
                              >
                                <Box
                                  sx={{
                                    width: 8,
                                    height: "70%",
                                    borderRadius: 1,
                                    mr: 0.75,
                                    bgcolor: "#4cbb17",
                                    flex: "0 0 auto",
                                  }}
                                />
                                <Box
                                  sx={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  <Typography
                                    component="span"
                                    sx={{
                                      fontSize: 12,
                                      fontWeight: 700,
                                      pr: 0.5,
                                    }}
                                  >
                                    {meta?.shortLabel ||
                                      meta?.label ||
                                      ev.vehicleId}
                                  </Typography>
                                  <Typography
                                    component="span"
                                    sx={{
                                      fontSize: 12,
                                      color: "rgba(255,255,255,0.82)",
                                    }}
                                  >
                                    {label}
                                  </Typography>
                                </Box>
                              </Box>
                            </Tooltip>
                          );
                        })}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Card>
    </Stack>
  );
}
