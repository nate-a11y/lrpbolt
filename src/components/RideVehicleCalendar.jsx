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
} from "react";
import { Box } from "@mui/material";
// [LRP:END:calendar:imports]
import { createPortal } from "react-dom";
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

// [LRP:BEGIN:calendar:useMeasuredHeight]
function useMeasuredHeight() {
  const ref = useRef(null);
  const [h, setH] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setH(Math.ceil(r.height));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return [ref, h];
}
// [LRP:END:calendar:useMeasuredHeight]

const VehiclePillWrapper = forwardRef(
  (
    {
      children,
      width,
      hidden = false,
      anchored = false,
      top = 0,
      stickyTopOffset = DEFAULT_STICKY_TOP,
    },
    ref,
  ) => (
    // [LRP:BEGIN:vehicleCalendar:visual-tune]
    <Box
      ref={ref}
      sx={{
        position: anchored ? "absolute" : "sticky",
        left: 0,
        top: anchored ? top : resolveTopCss(stickyTopOffset),
        zIndex: (theme) => theme.zIndex.appBar + 1,
        width,
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? "none" : "auto",
        borderRadius: 2,
        pl: 1.25,
        py: 0.4,
        bgcolor: "background.default",
        borderRight: "1px solid",
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        boxShadow: (t) => t.shadows[1],
      }}
    >
      {children}
    </Box>
    // [LRP:END:vehicleCalendar:visual-tune]
  ),
);

VehiclePillWrapper.displayName = "VehiclePillWrapper";

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

const OVERVIEW_LANE_HEIGHT = 28;
const OVERVIEW_EVENT_HEIGHT = 20;

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
  stickyPillAnchorId,
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
  const [stickyAnchorEl, setStickyAnchorEl] = useState(null);
  const [pillOffsets, setPillOffsets] = useState({});

  const rideRefs = useRef({});
  const pillRefs = useRef({});
  const lanesWrapperRef = useRef(null);
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

  // Hour ruler + horizontal scroll
  const scrollerRef = useRef(null);
  const [headerRef, headerH] = useMeasuredHeight();
  const pxPerHour = useMemo(() => (isMobile ? 62 : 88), [isMobile]);
  const hours = useMemo(
    () =>
      Array.from({ length: 25 }, (_, i) => date.startOf("day").add(i, "hour")),
    [date],
  );
  // width of the sticky label gutter (+ small spacing)
  const labelW = useMemo(() => (isMobile ? 140 : 200), [isMobile]);
  const gutter = labelW + 8;
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

  useEffect(() => {
    if (!stickyPillAnchorId) {
      setStickyAnchorEl(null);
      return;
    }
    if (typeof document === "undefined") return;
    let frame = null;
    const assign = () => {
      const anchor = document.getElementById(stickyPillAnchorId);
      if (anchor) {
        setStickyAnchorEl(anchor);
      } else {
        frame = requestAnimationFrame(assign);
      }
    };
    assign();
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [stickyPillAnchorId]);

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

  useEffect(() => {
    if (!stickyAnchorEl) {
      setPillOffsets({});
      return;
    }

    const anchor = stickyAnchorEl;
    const measure = () => {
      const wrapper = lanesWrapperRef.current;
      if (!wrapper) return;

      const wrapperTop = wrapper.getBoundingClientRect().top;
      const next = {};
      Object.entries(pillRefs.current).forEach(([vehicle, node]) => {
        if (!node) return;
        const nodeTop = node.getBoundingClientRect().top - wrapperTop;
        next[vehicle] = Math.max(0, Math.round(nodeTop));
      });
      setPillOffsets(next);

      const totalHeight = wrapper.scrollHeight;
      anchor.style.minHeight = `${totalHeight + 32}px`;
      anchor.style.paddingBottom = "16px";
    };

    measure();

    const wrapper = lanesWrapperRef.current;
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    if (resizeObserver && wrapper) {
      resizeObserver.observe(wrapper);
    }

    const scrollContainer = scrollerRef.current;
    const onScroll = () => measure();
    scrollContainer?.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      scrollContainer?.removeEventListener("scroll", onScroll);
      anchor.style.minHeight = "";
      anchor.style.paddingBottom = "";
    };
  }, [stickyAnchorEl, filteredGroups]);

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

  // ===== [RVTC:scrollH:start] =====
  const getNowX = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return 0;
    if (!date.isSame(now, "day")) return 0;
    const start = date.startOf("day");
    const end = start.add(24, "hour");
    const pct = clamp01(
      minutesBetween(start, now) / Math.max(1, minutesBetween(start, end)),
    );
    const timelineWidth = 24 * pxPerHour;
    const x = gutter + timelineWidth * pct;
    return Math.max(0, Math.min(x, el.scrollWidth));
  }, [date, now, pxPerHour, gutter]);

  const centerNow = useCallback(() => {
    if (!date.isSame(now, "day")) return;
    scrollToNow();
    const el = scrollerRef.current;
    if (!el) return;
    const x = getNowX();
    const target = Math.max(0, x - el.clientWidth / 2);
    el.scrollTo({ left: target, behavior: "smooth" });
  }, [date, now, scrollToNow, getNowX]);
  // ===== [RVTC:scrollH:end] =====

  const isToday = date.isSame(now, "day");
  const { dayStart, dayEnd } = getDayWindow(date, CST);
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
            {/* [LRP:BEGIN:vehicleCalendar:card] */}
            <Box
              sx={(t) => ({
                borderRadius: 2,
                border: `1px solid ${t.palette.divider}`,
                background:
                  t.palette.mode === "dark"
                    ? "rgba(16,16,16,0.95)"
                    : t.palette.background.paper,
                boxShadow: t.shadows[2],
                overflow: "hidden",
              })}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ px: 1, py: 0.75, bgcolor: theme.palette.action.hover }}
              >
                <Typography fontWeight={700} fontSize={13}>
                  Vehicle Availability Overview
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    size="small"
                    onClick={() => setShowOverview((v) => !v)}
                  >
                    {showOverview ? "Hide" : "Show"}
                  </Button>
                  <Button
                    size="small"
                    onClick={centerNow}
                    disabled={!isToday}
                    title="Center now on the overview"
                  >
                    Center Now
                  </Button>
                </Stack>
              </Stack>

              <Collapse in={showOverview} timeout="auto" unmountOnExit>
                {/* Hour ruler + lanes */}
                <Box sx={{ position: "relative", pt: 0, mt: 0 }}>
                  {/* [LRP:BEGIN:vehicleCalendar:visual-tune] */}
                  {!hideHeader && (
                    <Box
                      ref={headerRef}
                      sx={(t) => ({
                        position: "sticky",
                        top: stickyTopOffset || 0,
                        zIndex: t.zIndex.appBar + 1,
                        background:
                          t.palette.mode === "dark"
                            ? "rgba(10,10,10,0.9)"
                            : t.palette.background.paper,
                        backdropFilter: "saturate(1.05) blur(3px)",
                        borderBottom: `1px solid ${t.palette.divider}`,
                        px: 1,
                        py: 0.5,
                        m: 0,
                      })}
                    >
                      <Box
                        sx={{
                          position: "relative",
                          pl: `${gutter}px`,
                          minWidth: `${gutter + 24 * pxPerHour}px`,
                        }}
                      >
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: `repeat(24, ${pxPerHour}px)`,
                          }}
                        >
                          {hours.slice(0, 24).map((h, i) => (
                            <Box
                              key={i}
                              sx={{
                                height: 24,
                                borderLeft: i === 0 ? "none" : "1px dashed",
                                borderColor: "divider",
                                display: "flex",
                                alignItems: "center",
                                fontSize: 12,
                                color: "text.secondary",
                                pl: 0.5,
                              }}
                            >
                              {h.format("ha")}
                            </Box>
                          ))}
                        </Box>
                        {isToday && (
                          <Box
                            sx={{
                              position: "absolute",
                              left: `${
                                clamp01(
                                  minutesBetween(dayStart, now) /
                                    minutesBetween(dayStart, dayEnd),
                                ) * 100
                              }%`,
                              top: 0,
                              bottom: 0,
                              width: 2,
                              transform: "translateX(-1px)",
                              bgcolor: theme.palette.primary.main,
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  )}

                  <Box
                    ref={scrollerRef}
                    sx={{
                      position: "relative",
                      overflowX: "auto",
                      overflowY: "hidden",
                      scrollbarGutter: "stable",
                      WebkitOverflowScrolling: "touch",
                      px: 1,
                      pb: 1,
                      bgcolor: theme.palette.background.paper,
                    }}
                  >
                    <Stack
                      ref={lanesWrapperRef}
                      sx={{
                        pt: hideHeader ? 0 : headerH,
                        minWidth: `${gutter + 24 * pxPerHour}px`,
                      }}
                      spacing={1}
                    >
                      {groupedPacked.map(({ vehicle, lanes }) => {
                        const rideCount = lanes.reduce(
                          (acc, l) => acc + l.length,
                          0,
                        );
                        const setPillRef = (node) => {
                          if (node) {
                            pillRefs.current[vehicle] = node;
                          } else {
                            delete pillRefs.current[vehicle];
                          }
                        };
                        const renderChip = () => (
                          <Chip
                            size="small"
                            label={vehicle}
                            sx={{
                              bgcolor: vehicleColors[vehicle],
                              color: vehicleText[vehicle],
                              fontWeight: 600,
                            }}
                          />
                        );
                        const renderCount = () => (
                          <Typography variant="caption" color="text.secondary">
                            {plural(rideCount, "ride")}
                          </Typography>
                        );

                        const anchoredPill =
                          stickyAnchorEl &&
                          createPortal(
                            <VehiclePillWrapper
                              width={labelW}
                              anchored
                              top={pillOffsets[vehicle] ?? 0}
                              stickyTopOffset={stickyTopOffset}
                            >
                              {renderChip()}
                              {renderCount()}
                            </VehiclePillWrapper>,
                            stickyAnchorEl,
                          );

                        return (
                          <Box key={vehicle} sx={{ mb: 3 }}>
                            <Box sx={{ position: "relative" }}>
                              <VehiclePillWrapper
                                ref={setPillRef}
                                width={labelW}
                                hidden={Boolean(stickyAnchorEl)}
                                stickyTopOffset={stickyTopOffset}
                              >
                                {renderChip()}
                                {renderCount()}
                              </VehiclePillWrapper>
                              {anchoredPill}

                              {/* Lanes shifted to clear the sticky label gutter */}
                              <Box
                                sx={{
                                  position: "relative",
                                  pl: `${gutter}px`,
                                  minWidth: `${24 * pxPerHour}px`,
                                  height: lanes.length * OVERVIEW_LANE_HEIGHT,
                                }}
                              >
                                {lanes.map((lane, laneIdx) =>
                                  lane.map((ev) => {
                                    const span = percentSpan(
                                      ev,
                                      date,
                                      CST,
                                      scrollerRef.current?.clientWidth || 0,
                                    );
                                    if (!span.clamp) return null;
                                    const { left, width, durationMinutes } =
                                      span;
                                    const minWidth =
                                      durationMinutes === 0
                                        ? "2px"
                                        : durationMinutes <= 5
                                          ? "6px"
                                          : durationMinutes <= 10
                                            ? "4px"
                                            : undefined;
                                    return (
                                      <Tooltip
                                        key={ev.id}
                                        title={`${ev.start.format("h:mm A")} – ${ev.end.format("h:mm A")} • ${ev.title}`}
                                      >
                                        <Box
                                          onClick={() => {
                                            setSelectedEvent(ev);
                                            setModalOpen(true);
                                          }}
                                          sx={{
                                            position: "absolute",
                                            top: laneIdx * OVERVIEW_LANE_HEIGHT,
                                            left: `${left}%`,
                                            width: `${width}%`,
                                            minWidth,
                                            height: OVERVIEW_EVENT_HEIGHT,
                                            borderRadius: 1,
                                            bgcolor:
                                              vehicleColors[ev.vehicle] ||
                                              "grey.500",
                                            color:
                                              vehicleText[ev.vehicle] ||
                                              getContrastText(
                                                vehicleColors[ev.vehicle] ||
                                                  "#666",
                                              ),
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "0.75rem",
                                            fontWeight: 600,
                                            px: 0.5,
                                            cursor: "pointer",
                                            transition: "transform 120ms ease",
                                            overflow: "hidden",
                                            "&:hover": {
                                              transform: "translateY(-1px)",
                                            },
                                          }}
                                        >
                                          <span>{ev.vehicle}</span>
                                        </Box>
                                      </Tooltip>
                                    );
                                  }),
                                )}
                              </Box>
                            </Box>
                          </Box>
                        );
                      })}
                    </Stack>
                    {/* [LRP:END:vehicleCalendar:visual-tune] */}
                  </Box>
                </Box>
              </Collapse>
            </Box>
            {/* [LRP:END:vehicleCalendar:card] */}
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
