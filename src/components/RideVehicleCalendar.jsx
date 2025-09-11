/* Proprietary and confidential. See LICENSE. */
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
import IosShareIcon from "@mui/icons-material/IosShare";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { useVehicleSchedule } from "@/hooks/useVehicleSchedule.js";
import {
  toDayjs,
  packLanes,
  formatRangeLocal,
  minutesBetweenSafe,
  exportRidesCsv,
} from "@/utils/scheduleUtils.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const LRP = { green: "#4cbb17", black: "#060606", card: "#0b0b0b" };
const TIMELINE_HOURS = 24;
const NOW_MARKER_WIDTH = 2;

function toStartOfDay(input, tz) {
  const d = input ? toDayjs(input, tz) : dayjs().tz(tz || dayjs.tz.guess());
  return d
    ? d.startOf("day")
    : dayjs()
        .tz(tz || dayjs.tz.guess())
        .startOf("day");
}

export default function RideVehicleCalendar({
  date,
  vehicles = [],
  rides = [],
  tz,
  onShare,
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

  const {
    dayStart,
    dayEnd,
    ridesByVehicle,
    totals,
    overlapsByVehicle,
    tightGapsByVehicle,
  } = useVehicleSchedule({
    rides,
    vehicles,
    day: activeDay,
    tz: timezoneGuess,
  });

  const scrollRef = useRef(null);

  const scrollToNow = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const start = dayStart.valueOf();
    const end = dayEnd.valueOf();
    const now = dayjs().tz(timezoneGuess).valueOf();
    const clamped = Math.min(Math.max(now, start), end);
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
    const px = isMobile ? 64 : 80; // responsive scale
    return Math.round(px * TIMELINE_HOURS);
  }, [isMobile]);

  const filteredIds = useMemo(
    () =>
      vehicleFilter === "ALL" ? vehicles.map((v) => v.id) : [vehicleFilter],
    [vehicleFilter, vehicles],
  );

  function handleExportCsv() {
    exportRidesCsv({
      rides,
      tz: timezoneGuess,
      filename: `lrp-rides-${activeDay.format("YYYY-MM-DD")}.csv`,
    });
  }

  const now = dayjs().tz(timezoneGuess);

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
            {vehicles.map((v) => (
              <MenuItem key={v.id} value={v.id}>
                {v.shortLabel || v.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Chip
          size="small"
          label={`${totals.rides} Rides • ${totals.vehicles} Vehicles • ${totals.tightGaps} Tight Gaps • ${totals.overlaps} Overlaps`}
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
          <Tooltip title="Share">
            <span>
              <IconButton
                size="small"
                onClick={() => onShare && onShare({ day: activeDay, rides })}
                aria-label="Share"
                disabled={!onShare}
              >
                <IosShareIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Add to Calendar">
            <span>
              <IconButton
                size="small"
                onClick={() =>
                  onAddToCalendar && onAddToCalendar({ day: activeDay, rides })
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
              {now.isAfter(dayStart) && now.isBefore(dayEnd) && (
                <Box
                  sx={{
                    position: "absolute",
                    left: `${((now.valueOf() - dayStart.valueOf()) / (dayEnd.valueOf() - dayStart.valueOf())) * 100}%`,
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
            {filteredIds.map((vid) => {
              const vehicle = vehicles.find((v) => v.id === vid);
              const items = ridesByVehicle.get(vid) || [];
              const lanes = packLanes(items); // lane: Ride[]

              const overlaps = overlapsByVehicle.get(vid) || 0;
              const tightGaps = tightGapsByVehicle.get(vid) || 0;

              return (
                <Box key={vid} sx={{ mb: 2.5 }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ mb: 0.5 }}
                  >
                    <Chip
                      size="small"
                      label={vehicle?.shortLabel || vehicle?.label || vid}
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
                    {overlaps > 0 && (
                      <Chip
                        size="small"
                        color="error"
                        label={`${overlaps} overlaps`}
                        sx={{ fontWeight: 700 }}
                      />
                    )}
                    {tightGaps > 0 && (
                      <Chip
                        size="small"
                        color="warning"
                        label={`${tightGaps} tight gaps`}
                        sx={{ fontWeight: 700 }}
                      />
                    )}
                  </Stack>

                  {/* Render each lane as its own row to avoid overlap */}
                  <Stack spacing={0.75}>
                    {lanes.map((lane, idx) => (
                      <Box key={idx} sx={{ position: "relative", height: 28 }}>
                        {lane.map((ride) => {
                          const start = toDayjs(ride.startTime, timezoneGuess);
                          const end = toDayjs(ride.endTime, timezoneGuess);
                          if (!start || !end) return null;

                          // clamp to day window
                          const s = Math.max(
                            start.valueOf(),
                            dayStart.valueOf(),
                          );
                          const e = Math.min(end.valueOf(), dayEnd.valueOf());
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

                          const title = ride.title || "Trip";
                          const driver = ride.driverName
                            ? ` • ${ride.driverName}`
                            : "";
                          const label = `${title}${driver}`;
                          const sub = formatRangeLocal(
                            start,
                            end,
                            timezoneGuess,
                          );

                          return (
                            <Tooltip
                              key={ride.id}
                              title={
                                <Stack spacing={0.25}>
                                  <Typography
                                    variant="caption"
                                    sx={{ fontWeight: 700 }}
                                  >
                                    {label}
                                  </Typography>
                                  <Typography variant="caption">
                                    {sub}
                                  </Typography>
                                  <Typography variant="caption">
                                    {minutesBetweenSafe(start, end)} min
                                  </Typography>
                                </Stack>
                              }
                            >
                              <Box
                                role="button"
                                tabIndex={0}
                                onClick={() => onOpenRide && onOpenRide(ride)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && onOpenRide)
                                    onOpenRide(ride);
                                }}
                                sx={{
                                  position: "absolute",
                                  left: `${pctStart}%`,
                                  width: `${pctWidth}%`,
                                  height: 24,
                                  bgcolor: "rgba(76,187,23,0.18)",
                                  border: `1px solid ${LRP.green}`,
                                  borderRadius: 1.5,
                                  display: "flex",
                                  alignItems: "center",
                                  px: 1,
                                  overflow: "hidden",
                                  whiteSpace: "nowrap",
                                  textOverflow: "ellipsis",
                                  fontSize: 12,
                                  lineHeight: 1,
                                  color: "#fff",
                                  outline: "none",
                                  transition:
                                    "transform 120ms ease, box-shadow 120ms ease",
                                  "&:hover": {
                                    transform: "translateY(-1px)",
                                    boxShadow: `0 0 0 1px ${LRP.green}`,
                                  },
                                  "&:focus-visible": {
                                    boxShadow: `0 0 0 2px ${LRP.green}`,
                                  },
                                }}
                              >
                                <Box
                                  sx={{
                                    width: 8,
                                    height: "70%",
                                    borderRadius: 1,
                                    mr: 0.75,
                                    bgcolor: LRP.green,
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
                                      color: "#fff",
                                    }}
                                  >
                                    {vehicle?.shortLabel ||
                                      vehicle?.label ||
                                      "Vehicle"}
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
