/* Proprietary and confidential. See LICENSE. */
// [LRP:BEGIN:calendar:imports]
import {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
  memo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Box } from "@mui/material";
// [LRP:END:calendar:imports]
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import useMediaQuery from "@mui/material/useMediaQuery";
import TextField from "@mui/material/TextField";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import Skeleton from "@mui/material/Skeleton";
import Alert from "@mui/material/Alert";
import { useTheme } from "@mui/material/styles";
import Autocomplete from "@mui/material/Autocomplete";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers-pro";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

import dayjs, { toDayjs, isD } from "@/utils/dayjsSetup.js";
import logError from "@/utils/logError.js";
import {
  clampToWindow,
  getDayWindow,
  plural,
  compareGte,
  compareLte,
} from "@/utils/calendarTime.js";
import { getVehicleEvents } from "@/services/calendarService.js";
import {
  VEHICLE_CALENDARS,
  getCalendarIdsForVehicles,
} from "@/constants/vehicleCalendars.js";

import { TIMEZONE } from "../constants";

import PageContainer from "./PageContainer.jsx";

const cache = new Map();

const DEFAULT_STICKY_TOP = 64;

const resolveTopCss = (topValue) => {
  if (topValue == null) return 64;
  if (typeof topValue === "number") return topValue;
  return topValue;
};

const minutesBetween = (a, b) => Math.max(0, b.diff(a, "minute"));
const formatHm = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
};

function getLuminance(hex) {
  const c = hex.replace("#", "");
  const rgb = [0, 1, 2].map((i) => {
    let v = parseInt(c.substr(i * 2, 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
const getContrastText = (bg) => (getLuminance(bg) > 0.4 ? "#000" : "#fff");

const BASE_COLORS = [
  "#E6194B",
  "#3CB44B",
  "#FFE119",
  "#4363D8",
  "#F58231",
  "#911EB4",
  "#46F0F0",
  "#F032E6",
  "#BCF60C",
  "#FABEBE",
  "#008080",
  "#E6BEFF",
  "#9A6324",
  "#FFFAC8",
  "#800000",
  "#AAFFC3",
  "#808000",
  "#FFD8B1",
  "#000075",
  "#808080",
];

const adjustColor = (hex, adjustment) => {
  const rgb = hex.match(/\w\w/g).map((x) => parseInt(x, 16) / 255);
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  let h;
  let s;
  const l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rgb[0]:
        h = (rgb[1] - rgb[2]) / d + (rgb[1] < rgb[2] ? 6 : 0);
        break;
      case rgb[1]:
        h = (rgb[2] - rgb[0]) / d + 2;
        break;
      default:
        h = (rgb[0] - rgb[1]) / d + 4;
    }
    h /= 6;
  }
  h = (h + adjustment) % 1;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);
  return `#${[r, g, b]
    .map((x) =>
      Math.round(x * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

// ===== [RVTC:helpers:start] =====
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function parseGcTime({ dateTime, date, timeZone }, fallbackTz) {
  const tz = timeZone || fallbackTz || CST;

  if (dateTime) {
    try {
      const parsed = dayjs.utc(dateTime).tz(tz);
      if (parsed.isValid()) return parsed;
    } catch (error) {
      logError(error, {
        area: "RideVehicleCalendar",
        action: "parseGcTime",
        payload: { dateTime, tz },
      });
    }
    return toDayjs(dateTime, tz);
  }

  if (date) {
    try {
      const parsed = dayjs.tz(date, tz).startOf("day");
      if (parsed.isValid()) return parsed;
    } catch (error) {
      logError(error, {
        area: "RideVehicleCalendar",
        action: "parseGcDate",
        payload: { date, tz },
      });
    }
    return toDayjs(`${date}T00:00:00`, tz);
  }

  return null;
}

/** Greedy packing of events into non-overlapping lanes. Each lane is an array of events. */
function packIntoLanes(items) {
  const lanes = [];
  const sorted = [...items].sort(
    (a, b) => a.start.valueOf() - b.start.valueOf(),
  );
  for (const ev of sorted) {
    let placed = false;
    for (let i = 0; i < lanes.length; i += 1) {
      const lane = lanes[i];
      const last = lane[lane.length - 1];
      if (!last || !last.end.isAfter(ev.start)) {
        lane.push(ev);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([ev]);
  }
  return lanes;
}

/** Compute left% and width% for an event within the selected day, clamped to [0..100]. */
function percentSpan(ev, selectedDay, tz, containerWidth = 0) {
  if (!ev) {
    return { left: 0, width: 0, durationMinutes: 0, clamp: null };
  }

  const { dayStart, dayEnd } = getDayWindow(selectedDay, tz);
  const clamp =
    ev.clamp ||
    clampToWindow({ start: ev.start, end: ev.end }, dayStart, dayEnd, tz);
  if (!clamp) {
    return { left: 0, width: 0, durationMinutes: 0, clamp: null };
  }

  const windowStart = clamp.windowStart || dayStart;
  const windowEnd = clamp.windowEnd || dayEnd;
  const dayMs = Math.max(1, windowEnd.diff(windowStart, "millisecond"));
  const startOffset = clamp.start.diff(windowStart, "millisecond");
  const endOffset = clamp.end.diff(windowStart, "millisecond");

  const left = clamp01(startOffset / dayMs) * 100;
  let width = (Math.max(0, endOffset - startOffset) / dayMs) * 100;
  const available = Math.max(0, 100 - left);
  const minPct = containerWidth ? (2 / containerWidth) * 100 : 0.15;
  if (width < minPct) {
    width = available > 0 ? Math.min(minPct, available) : minPct;
  }
  width = Math.min(width, available);

  const durationMinutes = Math.max(0, clamp.end.diff(clamp.start, "minute"));

  return { left, width, durationMinutes, clamp };
}

function edgeChipFor(ride, selectedDay, tz) {
  if (!ride) return null;

  let clamp = ride.clamp || null;
  if (!clamp) {
    const { dayStart, dayEnd } = getDayWindow(selectedDay, tz);
    const fallback = clampToWindow(
      { start: ride.start, end: ride.end },
      dayStart,
      dayEnd,
      tz,
    );
    if (!fallback) return null;
    let reason = null;
    if (compareLte(ride.start, dayStart) && compareGte(ride.end, dayStart)) {
      reason = "fromPrevDay";
    }
    if (compareGte(ride.end, dayEnd) && compareLte(ride.start, dayEnd)) {
      reason = reason ? "spansBoth" : "intoNextDay";
    }
    clamp = { ...fallback, reason };
  }

  if (clamp.reason === "fromPrevDay") return "From Previous Day";
  if (clamp.reason === "intoNextDay") return "Spans Into Next Day";
  if (clamp.reason === "spansBoth") return "From Previous Day • Into Next Day";
  return null;
}
// ===== [RVTC:helpers:end] =====

const PX_PER_MIN_FALLBACK = 1.8;
const GUTTER_W = 170;
const HEADER_H = 36;
const LANE_H = 48;
const LANE_GAP = 8;

const AvailabilityOverview = forwardRef(function AvailabilityOverview(
  {
    vehicles = [],
    tz = "America/Chicago",
    pxPerMin: pxPerMinProp,
    minutesSinceVisibleStart = 0,
    onHideClick,
    onEventClick,
    selectedDay,
  },
  ref,
) {
  const pxPerMin = pxPerMinProp || PX_PER_MIN_FALLBACK;

  const scrollRef = useRef(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportW, setViewportW] = useState(0);

  const contentWidth = useMemo(() => 24 * 60 * pxPerMin, [pxPerMin]);
  const totalHeight = useMemo(
    () => HEADER_H + vehicles.length * (LANE_H + LANE_GAP) + 8,
    [vehicles.length],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onResize = () => setViewportW(el.clientWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrollLeft(el.scrollLeft);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const centerNow = useCallback(() => {
    if (typeof minutesSinceVisibleStart !== "number") return;
    const el = scrollRef.current;
    if (!el) return;
    const nowOffsetPx = minutesSinceVisibleStart * pxPerMin;
    const target = Math.max(0, nowOffsetPx - el.clientWidth / 2);
    el.scrollTo({ left: target, behavior: "smooth" });
  }, [pxPerMin, minutesSinceVisibleStart]);

  useImperativeHandle(ref, () => ({ centerNow }), [centerNow]);

  const showLeftShadow = scrollLeft > 0;
  const showRightShadow = scrollLeft + viewportW < contentWidth - 1;

  return (
    <Box sx={{ borderRadius: 3, bgcolor: "#060606", p: 1.5 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Typography variant="subtitle1" sx={{ color: "#fff", fontWeight: 600 }}>
          Vehicle Availability Overview
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography
            role="button"
            tabIndex={0}
            onClick={centerNow}
            sx={{
              color: "#4cbb17",
              cursor: "pointer",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Center Now
          </Typography>
          <Typography
            role="button"
            tabIndex={0}
            onClick={onHideClick}
            sx={{
              color: "#4cbb17",
              cursor: "pointer",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Hide
          </Typography>
        </Stack>
      </Stack>

      {/* Outer wrapper: sticky gutter + ONE horizontal scroller */}
      <Box
        sx={(t) => ({
          position: "relative",
          borderRadius: 2,
          border: `1px solid ${t.palette.divider}`,
          bgcolor: t.palette.background.paper,
          overflow: "hidden",
        })}
      >
        {/* LEFT STICKY GUTTER (frozen vehicle chips) */}
        <Box
          sx={(t) => ({
            position: "absolute",
            top: 0,
            left: 0,
            width: GUTTER_W,
            height: totalHeight,
            zIndex: 3,
            bgcolor: t.palette.background.paper,
            borderRight: `1px solid ${t.palette.divider}`,
          })}
        >
          {/* Header spacer line */}
          <Box
            sx={{
              height: HEADER_H,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          />
          {/* Vehicle chips list */}
          <Box sx={{ position: "relative", pt: 1, pb: 1 }}>
            {vehicles.map((v, idx) => {
              const chipLabel = v.name || v.label || v.vehicle || v.id;
              return (
                <Box
                  key={v.id}
                  sx={{
                    height: LANE_H,
                    display: "flex",
                    alignItems: "center",
                    px: 1,
                    mb: idx === vehicles.length - 1 ? 0 : `${LANE_GAP}px`,
                  }}
                >
                  <Chip
                    label={chipLabel}
                    size="small"
                    sx={{
                      bgcolor: v.color || "#1f1f1f",
                      color: "#fff",
                      borderRadius: "999px",
                      fontWeight: 700,
                    }}
                  />
                  {!!v.rideCount && (
                    <Typography
                      sx={{
                        ml: 1,
                        color: "rgba(255,255,255,0.72)",
                        fontSize: 12,
                      }}
                    >
                      {v.rideCount} {v.rideCount === 1 ? "ride" : "rides"}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* ONE horizontal scroller (header + bars) with left padding to clear gutter */}
        <Box
          ref={scrollRef}
          sx={{
            overflowX: "auto",
            overflowY: "hidden",
            position: "relative",
            pl: `${GUTTER_W}px`,
          }}
          aria-label="Availability timeline scroller"
          data-left-shadow={showLeftShadow ? 1 : 0}
          data-right-shadow={showRightShadow ? 1 : 0}
        >
          {/* Sticky header WITH NO GRADIENT behind labels */}
          <Box
            sx={(t) => ({
              position: "sticky",
              top: 0,
              zIndex: 2,
              bgcolor: t.palette.background.paper,
              borderBottom: `1px solid ${t.palette.divider}`,
            })}
          >
            <Box
              sx={{
                width: contentWidth,
                height: HEADER_H,
                position: "relative",
              }}
            >
              {Array.from({ length: 25 }).map((_, i) => {
                const left = i * 60 * pxPerMin;
                return (
                  <Box
                    key={i}
                    sx={{
                      position: "absolute",
                      left,
                      top: 0,
                      height: HEADER_H,
                    }}
                  >
                    {/* vertical tick */}
                    <Box
                      sx={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        width: 1,
                        bgcolor: "rgba(255,255,255,0.14)",
                      }}
                    />
                    {/* label: solid white text, NO gradient background */}
                    <Box
                      sx={{
                        position: "absolute",
                        top: 6,
                        left: 6,
                        fontSize: 12,
                        color: "#ffffff",
                        background: "transparent",
                        pointerEvents: "none",
                        userSelect: "none",
                        textShadow: "0 1px 2px rgba(0,0,0,0.7)",
                        WebkitFontSmoothing: "antialiased",
                        MozOsxFontSmoothing: "grayscale",
                      }}
                    >
                      {formatHourLabel(i)}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* NOW marker aligned to timeline (account for gutter) */}
          {typeof minutesSinceVisibleStart === "number" && (
            <Box
              sx={{
                position: "absolute",
                left: minutesSinceVisibleStart * pxPerMin + GUTTER_W,
                top: 0,
                bottom: 0,
                width: "2px",
                bgcolor: "#4cbb17",
                opacity: 0.9,
                pointerEvents: "none",
              }}
              aria-hidden
            />
          )}

          {/* Lanes/baselines + your bars */}
          <Box sx={{ width: contentWidth, position: "relative", pt: 1, pb: 1 }}>
            {vehicles.map((v, idx) => (
              <Box
                key={v.id}
                sx={{
                  position: "relative",
                  height: LANE_H,
                  mb: idx === vehicles.length - 1 ? 0 : `${LANE_GAP}px`,
                }}
              >
                {/* baseline */}
                <Box
                  sx={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "50%",
                    height: 6,
                    transform: "translateY(-50%)",
                    borderRadius: 999,
                    bgcolor: "rgba(255,255,255,0.1)",
                  }}
                />
                {/* Render your existing bars for this vehicle (absolute left/width via pxPerMin) */}
                <VehicleLaneBars
                  vehicle={v}
                  pxPerMin={pxPerMin}
                  tz={tz}
                  selectedDay={selectedDay}
                  onEventClick={onEventClick}
                />
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
});

function VehicleLaneBars({ vehicle, pxPerMin, tz, selectedDay, onEventClick }) {
  const lanes = vehicle?.lanes || [];
  if (!lanes.length) return null;

  const laneCount = Math.max(1, lanes.length);
  const contentWidth = 24 * 60 * pxPerMin;
  const trackGap = laneCount > 1 ? 4 : 0;
  const effectiveHeight = LANE_H - (laneCount - 1) * trackGap;
  const trackHeight = Math.max(12, effectiveHeight / laneCount);
  const eventHeight = Math.min(24, trackHeight - 2);
  const verticalOffset = Math.max(
    0,
    (LANE_H - (trackHeight * laneCount + trackGap * (laneCount - 1))) / 2,
  );

  return lanes.flatMap((lane, laneIdx) =>
    lane.map((ev) => {
      const span = percentSpan(ev, selectedDay, tz, contentWidth);
      if (!span.clamp) return null;

      const leftPx = (span.left / 100) * contentWidth;
      const widthPctPx = (span.width / 100) * contentWidth;
      const durationPx = span.durationMinutes * pxPerMin;
      const baseMinWidth =
        span.durationMinutes === 0
          ? 2
          : span.durationMinutes <= 5
            ? 6
            : span.durationMinutes <= 10
              ? 4
              : 0;
      const finalWidth = Math.max(widthPctPx, durationPx, baseMinWidth, 2);

      const laneTop =
        verticalOffset +
        laneIdx * (trackHeight + trackGap) +
        (trackHeight - eventHeight) / 2;
      const tooltipTitle = `${ev.start.format("h:mm A")} – ${ev.end.format("h:mm A")} • ${ev.title || ev.vehicle || "Ride"}`;
      const chipText = ev.vehicle || ev.title || "Ride";

      return (
        <Tooltip key={ev.id} title={tooltipTitle}>
          <Box
            onClick={() => onEventClick?.(ev)}
            sx={{
              position: "absolute",
              top: laneTop,
              left: leftPx,
              width: finalWidth,
              height: eventHeight,
              borderRadius: 999,
              bgcolor: vehicle.color || "grey.600",
              color: vehicle.textColor || "#000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              fontWeight: 600,
              px: 0.75,
              cursor: "pointer",
              transition: "transform 120ms ease",
              overflow: "hidden",
              boxShadow: "0 1px 2px rgba(0,0,0,0.35)",
              "&:hover": {
                transform: "translateY(-1px)",
              },
            }}
          >
            <span>{chipText}</span>
          </Box>
        </Tooltip>
      );
    }),
  );
}

function formatHourLabel(i) {
  if (i === 0 || i === 24) return "12am";
  if (i === 12) return "12pm";
  if (i < 12) return `${i}am`;
  return `${i - 12}pm`;
}

const CST = TIMEZONE;
const FILTERS_STORAGE_KEY = "lrp.calendar.filters";
const DEFAULT_FILTERS = { vehicles: ["ALL"], scrollToNow: true };

function RideVehicleCalendar({
  dateISO,
  data,
  hideHeader = false,
  stickyTopOffset = DEFAULT_STICKY_TOP,
  onCenterNow,
  persistedFilters,
  onFiltersChange,
  hideQuickActions = false,
  ...rest
} = {}) {
  const [date, setDate] = useState(() => {
    if (dateISO) {
      const parsed = dayjs(dateISO).tz(CST);
      if (parsed.isValid()) {
        return parsed;
      }
    }
    const stored = localStorage.getItem("rvcal.date");
    return stored ? dayjs(stored).tz(CST) : dayjs().tz(CST);
  });
  useEffect(() => {
    if (!dateISO) return;
    const parsed = dayjs(dateISO).tz(CST);
    if (!parsed.isValid()) return;
    setDate((prev) => {
      if (prev && prev.isValid() && prev.isSame(parsed, "day")) {
        return prev;
      }
      return parsed;
    });
  }, [dateISO]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const tz = useMemo(() => dayjs.tz?.guess?.() || CST, []);

  const normalizeEvents = useCallback(
    (rawItems = []) => {
      const dayReference =
        (date && typeof date.tz === "function"
          ? date.tz(tz)
          : toDayjs(date, tz)) ||
        (typeof dayjs.tz === "function" ? dayjs().tz(tz) : dayjs());

      const windowStart = dayReference.startOf("day");
      const windowEnd = windowStart.add(1, "day");

      return (rawItems || [])
        .map((item) => {
          if (!item) return null;

          const descriptionRaw =
            typeof item.description === "string" ? item.description : "";
          if (/Driver:\s*-/.test(descriptionRaw)) return null;

          const cleanedDescription = descriptionRaw
            .replace("(Lake Ride Pros)", "")
            .trim();

          const vehicleSource =
            (typeof item.vehicle === "string" && item.vehicle) ||
            (typeof item.vehicleName === "string" && item.vehicleName) ||
            cleanedDescription.match(/Vehicle:\s*(.+)/)?.[1] ||
            "Unknown";
          const vehicle = vehicleSource.trim();

          const summaryRaw =
            (typeof item.summary === "string" && item.summary) ||
            (typeof item.title === "string" && item.title) ||
            vehicle ||
            "Untitled";
          const title = summaryRaw.replace("(Lake Ride Pros)", "").trim();

          const isGooglePayload =
            item.start &&
            typeof item.start === "object" &&
            ("dateTime" in item.start || "date" in item.start);

          const startSource = isGooglePayload
            ? parseGcTime(item.start, tz)
            : toDayjs(item.start, tz);
          const endSource = isGooglePayload
            ? parseGcTime(item.end, tz)
            : toDayjs(item.end, tz);

          const start = toDayjs(startSource, tz);
          const end = toDayjs(endSource, tz);
          if (!isD(start) || !isD(end)) return null;
          if (end.valueOf() <= start.valueOf()) return null;

          const clamp = clampToWindow(
            { start, end },
            windowStart,
            windowEnd,
            tz,
          );
          if (!clamp) return null;

          let reason = null;
          if (compareLte(start, windowStart) && compareGte(end, windowStart)) {
            reason = "fromPrevDay";
          }
          if (compareGte(end, windowEnd) && compareLte(start, windowEnd)) {
            reason = reason ? "spansBoth" : "intoNextDay";
          }

          const visibleStart = clamp.start;
          const visibleEnd = clamp.end;
          const durationMs = Math.max(0, visibleEnd.diff(visibleStart));

          return {
            start,
            end,
            vehicle,
            title,
            description: cleanedDescription,
            clamp: { ...clamp, reason },
            visibleStart,
            visibleEnd,
            durationMs,
          };
        })
        .filter(Boolean)
        .map((event) => ({
          ...event,
          id: `${event.start.valueOf()}-${event.end.valueOf()}-${event.vehicle}-${event.title}`,
        }))
        .sort((a, b) => a.start.valueOf() - b.start.valueOf());
    },
    [date, tz],
  );
  useEffect(() => {
    if (!Array.isArray(data)) return;
    setEvents(normalizeEvents(data));
    setLoading(false);
    setError(null);
  }, [data, normalizeEvents]);
  const [filtersState, setFiltersState] = useState(() => {
    const base = { ...DEFAULT_FILTERS };
    if (persistedFilters && typeof persistedFilters === "object") {
      const { vehicles, scrollToNow } = persistedFilters;
      return {
        vehicles:
          Array.isArray(vehicles) && vehicles.length > 0
            ? vehicles
            : base.vehicles,
        scrollToNow:
          typeof scrollToNow === "boolean" ? scrollToNow : base.scrollToNow,
      };
    }
    try {
      const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          vehicles:
            Array.isArray(parsed?.vehicles) && parsed.vehicles.length > 0
              ? parsed.vehicles
              : base.vehicles,
          scrollToNow:
            typeof parsed?.scrollToNow === "boolean"
              ? parsed.scrollToNow
              : base.scrollToNow,
        };
      }
    } catch (err) {
      logError(err, { area: "CalendarHub", action: "hydrate-filters" });
    }
    try {
      const legacyRaw = localStorage.getItem("rvcal.vehicleFilter");
      if (legacyRaw) {
        const legacyParsed = JSON.parse(legacyRaw);
        if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
          return { ...base, vehicles: legacyParsed };
        }
      }
    } catch (err) {
      logError(err, { area: "CalendarHub", action: "hydrate-legacy-filters" });
    }
    return base;
  });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(
    () => localStorage.getItem("rvcal.compact") !== "false",
  );
  const [sectionState, setSectionState] = useState(() =>
    JSON.parse(localStorage.getItem("rvcal.sectionState") || "{}"),
  );
  const [now, setNow] = useState(() => dayjs().tz(tz));
  const { vehicles: vehicleFilter, scrollToNow: scrollToNowPref } =
    filtersState;
  const rideRefs = useRef({});
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const persistFilters = useCallback(
    (next) => {
      if (typeof onFiltersChange === "function") {
        try {
          onFiltersChange(next);
        } catch (err) {
          logError(err, { area: "CalendarHub", action: "onFiltersChange" });
        }
        return;
      }
      try {
        localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        logError(err, { area: "CalendarHub", action: "persistFilters" });
      }
    },
    [onFiltersChange],
  );

  const updateFilters = useCallback(
    (updates) => {
      setFiltersState((prev) => {
        const merged = {
          vehicles: prev.vehicles,
          scrollToNow: prev.scrollToNow,
        };

        if (Array.isArray(updates?.vehicles)) {
          merged.vehicles =
            updates.vehicles.length === 0
              ? [...DEFAULT_FILTERS.vehicles]
              : updates.vehicles;
        }

        if (typeof updates?.scrollToNow === "boolean") {
          merged.scrollToNow = updates.scrollToNow;
        }

        const changed =
          merged.scrollToNow !== prev.scrollToNow ||
          merged.vehicles.join("|") !== prev.vehicles.join("|");

        if (changed) {
          persistFilters(merged);
          return merged;
        }

        return prev;
      });
    },
    [persistFilters],
  );

  useEffect(() => {
    if (!persistedFilters) return;
    setFiltersState((prev) => {
      const merged = {
        vehicles:
          Array.isArray(persistedFilters.vehicles) &&
          persistedFilters.vehicles.length > 0
            ? persistedFilters.vehicles
            : prev.vehicles,
        scrollToNow:
          typeof persistedFilters.scrollToNow === "boolean"
            ? persistedFilters.scrollToNow
            : prev.scrollToNow,
      };
      const changed =
        merged.scrollToNow !== prev.scrollToNow ||
        merged.vehicles.join("|") !== prev.vehicles.join("|");
      return changed ? merged : prev;
    });
  }, [persistedFilters]);

  // ===== [RVTC:state:start] =====
  const [showOverview, setShowOverview] = useState(() => {
    const raw = localStorage.getItem("rvcal.overview");
    return raw == null ? true : raw === "true";
  });
  useEffect(() => {
    localStorage.setItem("rvcal.overview", String(showOverview));
  }, [showOverview]);

  const pxPerHour = useMemo(() => (isMobile ? 62 : 88), [isMobile]);
  // ===== [RVTC:state:end] =====

  useEffect(() => {
    const id = setInterval(() => setNow(dayjs().tz(tz)), 60000);
    return () => clearInterval(id);
  }, [tz]);

  useEffect(() => {
    localStorage.setItem("rvcal.date", date.format("YYYY-MM-DD"));
  }, [date]);
  useEffect(() => {
    localStorage.setItem("rvcal.compact", compactMode);
  }, [compactMode]);
  useEffect(() => {
    localStorage.setItem("rvcal.sectionState", JSON.stringify(sectionState));
  }, [sectionState]);

  const vehicles = useMemo(
    () => [...new Set(events.map((e) => e.vehicle))],
    [events],
  );

  const vehicleColors = useMemo(() => {
    const stored = JSON.parse(localStorage.getItem("vehicleColors") || "{}");
    const colors = {};
    vehicles.forEach((v, idx) => {
      if (!stored[v]) {
        const base = BASE_COLORS[idx % BASE_COLORS.length];
        const adjust = Math.floor(idx / BASE_COLORS.length) * 0.07;
        stored[v] = idx < BASE_COLORS.length ? base : adjustColor(base, adjust);
      }
      colors[v] = stored[v];
    });
    localStorage.setItem("vehicleColors", JSON.stringify(stored));
    return colors;
  }, [vehicles]);

  const vehicleText = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(vehicleColors).map(([v, c]) => [v, getContrastText(c)]),
      ),
    [vehicleColors],
  );

  useEffect(() => {
    const key = `${date.format("YYYY-MM-DD")}:${tz}`;
    const cached = cache.get(key);
    if (cached) {
      setEvents(cached);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const fallbackPrimary = import.meta.env.VITE_CALENDAR_ID;
        const filterVehicles = filtersState?.vehicles || [];
        const selectedVehicles = filterVehicles.includes("ALL")
          ? Object.keys(VEHICLE_CALENDARS).length
            ? Object.keys(VEHICLE_CALENDARS)
            : [...new Set(events.map((event) => event.vehicle))]
          : filterVehicles;

        const calendarIds = getCalendarIdsForVehicles(
          selectedVehicles,
          fallbackPrimary,
        );

        const idsToQuery = calendarIds.length
          ? calendarIds
          : [fallbackPrimary].filter(Boolean);

        if (!idsToQuery.length) {
          setEvents([]);
          setLoading(false);
          setError(
            new Error(
              "No calendar ID configured. Set VITE_CALENDAR_ID or vehicle mapping.",
            ),
          );
          return;
        }

        const { events: items } = await getVehicleEvents({
          calendarIds: idsToQuery,
          start: date.startOf("day"),
          end: date.endOf("day"),
          tz,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        const parsed = normalizeEvents(items);
        cache.set(key, parsed);
        setEvents(parsed);
      } catch (err) {
        if (!controller.signal.aborted) {
          logError(err, {
            area: "RideVehicleCalendar",
            action: "fetchEvents",
            hint: "calendar-service",
          });
          setError(err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, normalizeEvents, tz]);

  const grouped = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      if (!map[e.vehicle]) map[e.vehicle] = [];
      map[e.vehicle].push({ ...e });
    });
    return Object.entries(map).map(([vehicle, rides]) => {
      rides.sort((a, b) => a.start.valueOf() - b.start.valueOf());
      let total = 0;
      rides.forEach((r, i) => {
        total += minutesBetween(r.start, r.end);
        if (i > 0) {
          r.tightGap = minutesBetween(rides[i - 1].end, r.start) <= 10;
        }
      });
      return { vehicle, rides, total };
    });
  }, [events]);

  const overlapsMap = useMemo(() => {
    const map = new Map();
    grouped.forEach(({ rides }) => {
      for (let i = 0; i < rides.length; i++) {
        for (let j = i + 1; j < rides.length; j++) {
          const a = rides[i];
          const b = rides[j];
          if (a.start.isBefore(b.end) && b.start.isBefore(a.end)) {
            if (!map.has(a.id)) map.set(a.id, []);
            if (!map.has(b.id)) map.set(b.id, []);
            map.get(a.id).push(b);
            map.get(b.id).push(a);
          }
        }
      }
    });
    return map;
  }, [grouped]);

  const filteredGroups = useMemo(() => {
    if (vehicleFilter.includes("ALL")) return grouped;
    return grouped.filter((g) => vehicleFilter.includes(g.vehicle));
  }, [grouped, vehicleFilter]);

  const flatFiltered = useMemo(
    () => filteredGroups.flatMap((g) => g.rides),
    [filteredGroups],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const items = [];

      if (Array.isArray(flatFiltered) && flatFiltered.length > 0) {
        flatFiltered.forEach((ev) => {
          items.push({
            startTime: ev.start,
            endTime: ev.end,
            summary: ev.title || ev.vehicle || "LRP Ride",
            location: ev.vehicle || "",
            description: ev.description || "",
          });
        });
      } else if (Array.isArray(data?.events)) {
        data.events.forEach((ev) => {
          items.push({
            startTime: ev.startTime || ev.start,
            endTime: ev.endTime || ev.end,
            summary: ev.title || ev.vehicle || ev.vehicleName || "LRP Ride",
            location: ev.pickup || ev.location || "",
            description: ev.notes || ev.description || "",
          });
        });
      }

      window.__LRP_DAYDATA = items;
    } catch (e) {
      logError(e, { area: "RideVehicleCalendar", action: "publishDayData" });
    }
  }, [flatFiltered, data]);

  // ===== [RVTC:lanes:start] =====
  const groupedPacked = useMemo(() => {
    // Reuse filtered groups to respect vehicle filter
    return filteredGroups.map(({ vehicle, rides }) => {
      const lanes = packIntoLanes(rides);
      return { vehicle, lanes };
    });
  }, [filteredGroups]);
  // ===== [RVTC:lanes:end] =====

  const overviewVehicles = useMemo(
    () =>
      groupedPacked.map(({ vehicle, lanes }) => ({
        id: vehicle,
        label: vehicle,
        lanes,
        color: vehicleColors[vehicle],
        textColor: vehicleText[vehicle],
        rideCount: lanes.reduce((acc, lane) => acc + lane.length, 0),
      })),
    [groupedPacked, vehicleColors, vehicleText],
  );

  const summary = useMemo(() => {
    const vehicles = new Set();
    let tight = 0;
    let overlap = 0;
    events.forEach((e) => {
      vehicles.add(e.vehicle);
      if (e.tightGap) tight++;
      if (overlapsMap.has(e.id)) overlap++;
    });
    return {
      rides: events.length,
      vehicles: vehicles.size,
      tight,
      overlap,
    };
  }, [events, overlapsMap]);

  const vehicleOptions = useMemo(() => ["ALL", ...vehicles], [vehicles]);

  const handlePrevDay = useCallback(() => {
    setDate((d) => d.subtract(1, "day"));
  }, []);
  const handleNextDay = useCallback(() => {
    setDate((d) => d.add(1, "day"));
  }, []);
  const handleToggleSection = (v) => {
    setSectionState((s) => ({ ...s, [v]: !s[v] }));
  };

  const scrollToNow = useCallback(() => {
    const target = flatFiltered.find(
      (r) =>
        (now.isAfter(r.start) && now.isBefore(r.end)) || r.start.isAfter(now),
    );
    if (target) {
      rideRefs.current[target.id]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [flatFiltered, now]);

  const availabilityOverviewRef = useRef(null);
  const pxPerMin = useMemo(() => pxPerHour / 60, [pxPerHour]);
  const { dayStart, dayEnd } = useMemo(() => getDayWindow(date, CST), [date]);
  const isToday = useMemo(() => date.isSame(now, "day"), [date, now]);
  const minutesSinceVisibleStart = useMemo(() => {
    if (!isToday) return null;
    const diff = minutesBetween(dayStart, now);
    return Math.min(diff, 24 * 60);
  }, [isToday, dayStart, now]);

  const centerNow = useCallback(() => {
    if (!isToday) return;
    scrollToNow();
    availabilityOverviewRef.current?.centerNow();
  }, [isToday, scrollToNow]);

  const handleOverviewEventClick = useCallback((event) => {
    if (!event) return;
    setSelectedEvent(event);
    setModalOpen(true);
  }, []);

  const nowPct = isToday
    ? (100 * minutesBetween(dayStart, now)) / minutesBetween(dayStart, dayEnd)
    : null;
  const selectedEdgeChip = edgeChipFor(selectedEvent, date, CST);

  useEffect(() => {
    if (!scrollToNowPref) return;
    if (!isToday) return;
    if (loading) return;
    centerNow();
  }, [scrollToNowPref, isToday, loading, centerNow]);

  useEffect(() => {
    if (onCenterNow !== "init") return;
    const id = setTimeout(() => centerNow(), 200);
    return () => clearTimeout(id);
  }, [onCenterNow, centerNow]);

  // [LRP:BEGIN:calendar:eventBridge]
  useEffect(() => {
    const onCenter = () => {
      requestAnimationFrame(centerNow);
    };
    window.addEventListener("calendar:center-now", onCenter);
    return () => window.removeEventListener("calendar:center-now", onCenter);
  }, [centerNow]);
  // [LRP:END:calendar:eventBridge]

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <PageContainer {...rest}>
        <Box sx={{ width: "100%" }}>
          {!hideHeader && (
            <Typography variant="h5" gutterBottom>
              🚖 Ride & Vehicle Calendar
            </Typography>
          )}

          <Stack direction="row" spacing={1} alignItems="center" mb={2}>
            <IconButton
              size="small"
              onClick={handlePrevDay}
              aria-label="Previous day"
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <Typography variant="subtitle1">
              {date.format("dddd, MMMM D")}
            </Typography>
            <IconButton
              size="small"
              onClick={handleNextDay}
              aria-label="Next day"
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Box sx={{ width: "100%" }}>
            <Stack
              direction={isMobile ? "column" : "row"}
              spacing={2}
              alignItems="center"
              mb={2}
              sx={{ width: "100%", flexWrap: "wrap", rowGap: 1 }}
            >
              <DatePicker
                value={date}
                onChange={(newDate) => newDate && setDate(dayjs(newDate))}
                slotProps={{ textField: { size: "small" } }}
              />
              <Autocomplete
                multiple
                options={vehicleOptions}
                value={vehicleFilter}
                onChange={(e, val) => {
                  const list = Array.isArray(val) ? val : [];
                  let next = list;
                  if (next.includes("ALL") && next.length > 1) {
                    next = next.filter((v) => v !== "ALL");
                  }
                  updateFilters({
                    vehicles:
                      next.length === 0 ? [...DEFAULT_FILTERS.vehicles] : next,
                  });
                }}
                filterSelectedOptions
                disableCloseOnSelect
                getOptionLabel={(option) =>
                  option === "ALL" ? "All Vehicles" : option
                }
                renderOption={(props, option) => {
                  const { key, ...rest } = props;
                  return (
                    <Box
                      component="li"
                      key={key}
                      {...rest}
                      sx={{
                        backgroundColor:
                          option === "ALL" ? undefined : vehicleColors[option],
                        color:
                          option === "ALL" ? undefined : vehicleText[option],
                        fontWeight: 500,
                        "&:hover": {
                          backgroundColor:
                            option === "ALL"
                              ? undefined
                              : vehicleColors[option],
                          opacity: 0.9,
                        },
                      }}
                    >
                      {option === "ALL" ? "All Vehicles" : option}
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Filter Vehicles" size="small" />
                )}
                sx={{ minWidth: 260, width: { xs: "100%", sm: "auto" } }}
              />
            </Stack>
          </Box>

          {!hideQuickActions && (
            <Box
              sx={{
                position: "sticky",
                top: resolveTopCss(stickyTopOffset),
                zIndex: 1,
                backgroundColor: theme.palette.background.default,
                borderBottom: 1,
                borderColor: "divider",
                py: 1,
                mb: 2,
                width: "100%",
              }}
            >
              <Stack
                direction={isMobile ? "column" : "row"}
                spacing={2}
                alignItems={isMobile ? "flex-start" : "center"}
                justifyContent="space-between"
              >
                <Typography fontSize={14}>
                  {plural(summary.rides, "ride")} •{" "}
                  {plural(summary.vehicles, "vehicle")} •{" "}
                  {plural(summary.tight, "tight gap")} •{" "}
                  {plural(summary.overlap, "overlap")}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button size="small" onClick={() => setDate(dayjs().tz(CST))}>
                    Today
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      scrollToNow();
                      centerNow();
                    }}
                  >
                    Scroll to Now
                  </Button>
                  <Tooltip title="Keep the view centered on now when opening today">
                    <Switch
                      size="small"
                      checked={scrollToNowPref}
                      onChange={(event) =>
                        updateFilters({ scrollToNow: event.target.checked })
                      }
                      inputProps={{ "aria-label": "Auto scroll to now" }}
                    />
                  </Tooltip>
                  <Tooltip title="Toggle Compact Mode">
                    <Switch
                      size="small"
                      checked={compactMode}
                      onChange={() => setCompactMode((v) => !v)}
                    />
                  </Tooltip>
                </Stack>
              </Stack>
            </Box>
          )}
          {/* ===== [RVTC:overview:start] ===== */}
          <Box sx={{ mb: 2 }}>
            {showOverview ? (
              <AvailabilityOverview
                ref={availabilityOverviewRef}
                vehicles={overviewVehicles}
                tz={tz}
                pxPerMin={pxPerMin}
                minutesSinceVisibleStart={minutesSinceVisibleStart}
                onHideClick={() => setShowOverview(false)}
                onEventClick={handleOverviewEventClick}
                selectedDay={date}
              />
            ) : (
              <Box
                sx={{
                  borderRadius: 3,
                  bgcolor: "#060606",
                  p: 1.5,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography
                    variant="subtitle1"
                    sx={{ color: "#fff", fontWeight: 600 }}
                  >
                    Vehicle Availability Overview
                  </Typography>
                  <Button size="small" onClick={() => setShowOverview(true)}>
                    Show
                  </Button>
                </Stack>
              </Box>
            )}
          </Box>
          {/* ===== [RVTC:overview:end] ===== */}

          {error && (
            <Alert
              severity="error"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => setDate((d) => d.clone())}
                >
                  Retry
                </Button>
              }
              sx={{ mb: 2, width: "100%" }}
            >
              Failed to load rides.
            </Alert>
          )}

          {loading ? (
            <Stack spacing={compactMode ? 1 : 2} sx={{ width: "100%" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    p: compactMode ? 1.25 : 2,
                    borderRadius: 2,
                    bgcolor:
                      theme.palette.mode === "dark" ? "#1e1e1e" : "#f8f8f8",
                    width: "100%",
                  }}
                >
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="40%" />
                  <Skeleton variant="rectangular" height={4} />
                </Box>
              ))}
            </Stack>
          ) : filteredGroups.length === 0 ? (
            <Typography sx={{ width: "100%" }}>
              No rides scheduled for this date.
            </Typography>
          ) : (
            filteredGroups.map(({ vehicle, rides, total }) => {
              const expanded = sectionState[vehicle] !== false;
              return (
                <Box key={vehicle} mb={2} sx={{ width: "100%" }}>
                  <Chip
                    label={`${vehicle} • ${plural(rides.length, "ride")} • ${formatHm(total)}`}
                    onClick={() => handleToggleSection(vehicle)}
                    onDelete={() => handleToggleSection(vehicle)}
                    deleteIcon={
                      expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />
                    }
                    sx={{
                      backgroundColor: vehicleColors[vehicle],
                      color: vehicleText[vehicle],
                      fontWeight: 500,
                      mb: 1,
                    }}
                  />
                  <Collapse in={expanded} timeout="auto" unmountOnExit>
                    <Stack spacing={compactMode ? 1 : 2} sx={{ width: "100%" }}>
                      {rides.map((event) => {
                        const span = percentSpan(event, date, CST);
                        const startPct = span.left;
                        const widthPct = span.width;
                        const durationMinutes = span.durationMinutes;
                        const edgeChipLabel = edgeChipFor(event, date, CST);
                        const minWidth =
                          durationMinutes === 0
                            ? "2px"
                            : durationMinutes <= 5
                              ? "6px"
                              : durationMinutes <= 10
                                ? "4px"
                                : undefined;
                        return (
                          <Box
                            key={event.id}
                            ref={(el) => (rideRefs.current[event.id] = el)}
                            onClick={() => {
                              setSelectedEvent(event);
                              setModalOpen(true);
                            }}
                            sx={{
                              p: compactMode ? 1.25 : 2,
                              borderRadius: 2,
                              cursor: "pointer",
                              borderLeft: `6px solid ${vehicleColors[event.vehicle]}`,
                              backgroundColor:
                                theme.palette.mode === "dark"
                                  ? "#1e1e1e"
                                  : "#f8f8f8",
                              "&:hover": {
                                backgroundColor:
                                  theme.palette.mode === "dark"
                                    ? "#2a2a2a"
                                    : "#f1f1f1",
                              },
                              width: "100%",
                            }}
                          >
                            <Typography
                              fontWeight="bold"
                              display="flex"
                              alignItems="center"
                            >
                              <DirectionsCarIcon
                                fontSize="small"
                                sx={{ mr: 1 }}
                              />
                              {event.title}
                            </Typography>
                            <Typography fontSize={14}>
                              {event.start.format("h:mm A")} –{" "}
                              {event.end.format("h:mm A")}
                            </Typography>
                            <Chip
                              label={event.vehicle}
                              size="small"
                              sx={{
                                mt: 0.5,
                                backgroundColor: vehicleColors[event.vehicle],
                                color: vehicleText[event.vehicle],
                                fontWeight: 500,
                                fontSize: "0.75rem",
                              }}
                            />
                            <Box
                              sx={{
                                position: "relative",
                                height: 4,
                                mt: 1,
                                bgcolor:
                                  theme.palette.mode === "dark"
                                    ? "grey.800"
                                    : "grey.300",
                              }}
                            >
                              <Box
                                sx={{
                                  position: "absolute",
                                  left: `${startPct}%`,
                                  width: `${widthPct}%`,
                                  minWidth,
                                  top: 0,
                                  bottom: 0,
                                  bgcolor: vehicleColors[event.vehicle],
                                }}
                              />
                              {isToday && nowPct >= 0 && nowPct <= 100 && (
                                <Box
                                  sx={{
                                    position: "absolute",
                                    left: `${nowPct}%`,
                                    top: -2,
                                    bottom: -2,
                                    width: 2,
                                    bgcolor: theme.palette.primary.main,
                                  }}
                                />
                              )}
                            </Box>
                            <Stack direction="row" spacing={1} mt={1}>
                              {event.tightGap && (
                                <Chip
                                  label="Tight Gap"
                                  color="warning"
                                  size="small"
                                />
                              )}
                              {overlapsMap.has(event.id) && (
                                <Chip
                                  label="Overlap"
                                  color="error"
                                  size="small"
                                />
                              )}
                              {edgeChipLabel && (
                                <Chip
                                  size="small"
                                  label={edgeChipLabel}
                                  sx={{
                                    bgcolor: "primary.main",
                                    color: "#000",
                                    fontWeight: 600,
                                    mr: 1,
                                  }}
                                />
                              )}
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Collapse>
                </Box>
              );
            })
          )}
        </Box>

        <Dialog
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          fullWidth
          maxWidth="sm"
          fullScreen={isMobile}
        >
          <Box p={3}>
            <Typography variant="h6" gutterBottom>
              {selectedEvent?.title}
            </Typography>
            <Typography variant="body2">
              {selectedEvent?.start.format("dddd, MMMM D")}
              <br />
              {selectedEvent?.start.format("h:mm A")} –{" "}
              {selectedEvent?.end.format("h:mm A")}
            </Typography>
            {selectedEdgeChip && (
              <Stack direction="row" spacing={1} mt={1}>
                <Chip
                  size="small"
                  label={selectedEdgeChip}
                  sx={{
                    bgcolor: "primary.main",
                    color: "#000",
                    fontWeight: 600,
                  }}
                />
              </Stack>
            )}
            {selectedEvent?.tightGap && (
              <Chip
                label="Tight Gap to Previous Ride"
                color="warning"
                sx={{ mt: 1 }}
              />
            )}
            {overlapsMap.get(selectedEvent?.id)?.length > 0 && (
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Overlaps:
                </Typography>
                <Stack spacing={0.5}>
                  {overlapsMap.get(selectedEvent.id).map((o) => (
                    <Typography key={o.id} variant="body2">
                      {o.title} ({o.start.format("h:mm A")} –{" "}
                      {o.end.format("h:mm A")})
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}
            {selectedEvent?.description && (
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Details:
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {selectedEvent.description}
                </Typography>
              </Box>
            )}
            <Box textAlign="right" mt={3}>
              <Button
                onClick={() => setModalOpen(false)}
                variant="outlined"
                sx={{ width: { xs: "100%", sm: "auto" } }}
              >
                Close
              </Button>
            </Box>
          </Box>
        </Dialog>
      </PageContainer>
    </LocalizationProvider>
  );
}

export default memo(RideVehicleCalendar);
