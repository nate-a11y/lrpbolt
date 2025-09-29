/* Proprietary and confidential. See LICENSE. */
import {
  useEffect,
  useState,
  useMemo,
  useRef,
  memo,
  useCallback,
  forwardRef,
} from "react";
import { createPortal } from "react-dom";
import {
  Box,
  Typography,
  Button,
  Dialog,
  Stack,
  Chip,
  useMediaQuery,
  useTheme,
  TextField,
  Switch,
  Tooltip,
  IconButton,
  Collapse,
  Skeleton,
  Alert,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ShareIcon from "@mui/icons-material/Share";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers-pro";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

import { dayjs } from "@/utils/time";

import { TIMEZONE } from "../constants";
import { fetchWithRetry } from "../utils/network";
import logError from "../utils/logError.js";

import PageContainer from "./PageContainer.jsx";

const cache = new Map();

const VehiclePillWrapper = forwardRef(
  ({ children, width, hidden = false, anchored = false, top = 0 }, ref) => (
    <Box
      ref={ref}
      sx={{
        width,
        pr: 1,
        mb: 0.5,
        bgcolor: "background.default",
        borderRight: "1px solid",
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        boxShadow: (theme) => theme.shadows[2],
        position: anchored ? "absolute" : "sticky",
        left: 0,
        top: anchored ? top : 0,
        zIndex: (theme) => theme.zIndex.appBar,
        visibility: hidden ? "hidden" : "visible",
      }}
    >
      {children}
    </Box>
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

const formatIcsDate = (d) => d.utc().format("YYYYMMDD[T]HHmmss[Z]");

function downloadCsv(rides, overlapsMap, date) {
  const header = ["Start", "End", "Vehicle", "Title", "TightGap", "Overlap"];
  const rows = rides.map((r) => [
    r.start.format("HH:mm"),
    r.end.format("HH:mm"),
    r.vehicle,
    r.title,
    r.tightGap ? "true" : "false",
    overlapsMap.has(r.id) ? "true" : "false",
  ]);
  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${date.format("YYYY-MM-DD")}-rides.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadIcs(rides, date) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LRP//RideCalendar//EN",
  ];
  rides.forEach((r) => {
    lines.push("BEGIN:VEVENT");
    lines.push(`DTSTART:${formatIcsDate(r.start)}`);
    lines.push(`DTEND:${formatIcsDate(r.end)}`);
    lines.push(`SUMMARY:${r.title}`);
    lines.push(`LOCATION:${r.vehicle}`);
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${date.format("YYYY-MM-DD")}-rides.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function shareDay(rides, date) {
  const text = [
    `Rides for ${date.format("YYYY-MM-DD")}:`,
    ...rides.map(
      (r) =>
        `${r.start.format("HH:mm")}-${r.end.format("HH:mm")} ${r.title} (${r.vehicle})`,
    ),
  ].join("\n");
  try {
    if (navigator.share) {
      await navigator.share({ text });
    } else {
      await navigator.clipboard.writeText(text);
    }
  } catch (err) {
    logError(err, "RideVehicleCalendar:share");
  }
}

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

function parseGcTime({ dateTime, date, timeZone }) {
  try {
    const tz = timeZone || CST;
    return dateTime
      ? dayjs.utc(dateTime).tz(tz)
      : dayjs.tz(date, tz).startOf("day");
  } catch (e) {
    logError(e, "RideVehicleCalendar:parseGcTime");
    return dateTime
      ? dayjs.utc(dateTime).tz(timeZone || CST)
      : dayjs.tz(date, timeZone || CST).startOf("day");
  }
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

/** Compute left% and width% for an event within [dayStart, dayEnd], clamped to [0..100]. */
function percentSpan(ev, dayStart, dayEnd) {
  const total = dayEnd.diff(dayStart, "minute");
  const leftMins = Math.max(
    0,
    Math.min(total, ev.start.diff(dayStart, "minute")),
  );
  const rightMins = Math.max(
    0,
    Math.min(total, ev.end.diff(dayStart, "minute")),
  );
  const left = clamp01(leftMins / total) * 100;
  const width = Math.max(
    1.5,
    (clamp01(rightMins / total) - clamp01(leftMins / total)) * 100,
  );
  return { left, width };
}
// ===== [RVTC:helpers:end] =====

const API_KEY = import.meta.env.VITE_CALENDAR_API_KEY;
const CALENDAR_ID = import.meta.env.VITE_CALENDAR_ID;
const CST = TIMEZONE;
const FILTERS_STORAGE_KEY = "lrp.calendar.filters";
const DEFAULT_FILTERS = { vehicles: ["ALL"], scrollToNow: true };

function RideVehicleCalendar({
  persistedFilters,
  onFiltersChange,
  stickyPillAnchorId,
} = {}) {
  const [date, setDate] = useState(() => {
    const stored = localStorage.getItem("rvcal.date");
    return stored ? dayjs(stored).tz(CST) : dayjs().tz(CST);
  });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
  const [now, setNow] = useState(dayjs().tz(CST));
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
  const rulerRef = useRef(null);
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
    const id = setInterval(() => setNow(dayjs().tz(CST)), 60000);
    return () => clearInterval(id);
  }, []);

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

  useEffect(() => {
    if (!stickyAnchorEl) {
      setPillOffsets({});
      return;
    }
    const anchor = stickyAnchorEl;
    const nextOffsets = {};
    Object.entries(pillRefs.current).forEach(([vehicle, node]) => {
      if (!node) return;
      nextOffsets[vehicle] = node.offsetTop || 0;
    });
    setPillOffsets(nextOffsets);
    const previousMinHeight = anchor.style.minHeight;
    if (lanesWrapperRef.current) {
      const height = lanesWrapperRef.current.offsetHeight;
      if (height) {
        anchor.style.minHeight = `${height}px`;
      }
    }
    return () => {
      anchor.style.minHeight = previousMinHeight;
    };
  }, [stickyAnchorEl, groupedPacked]);

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
    const key = date.format("YYYY-MM-DD");
    const cached = cache.get(key);
    if (cached) {
      setEvents(cached);
      setLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    const fetchEvents = async () => {
      setLoading(true);
      setError(null);
      const start = date.startOf("day").toISOString();
      const end = date.endOf("day").toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        CALENDAR_ID,
      )}/events?key=${API_KEY}&timeMin=${start}&timeMax=${end}&singleEvents=true&orderBy=startTime`;
      try {
        const res = await fetchWithRetry(url, { signal: controller.signal });
        const data = await res.json();
        if (controller.signal.aborted) return;
        const parsed = (data.items || [])
          .filter((item) => !/Driver:\s*-/.test(item.description))
          .map((item) => {
            const desc = (item.description || "")
              .replace("(Lake Ride Pros)", "")
              .trim();
            const vehicle = (
              desc.match(/Vehicle:\s*(.+)/)?.[1] || "Unknown"
            ).trim();
            const title =
              item.summary?.replace("(Lake Ride Pros)", "").trim() ||
              "Untitled";
            const start = parseGcTime(item.start);
            const end = parseGcTime(item.end);
            return { start, end, vehicle, title, description: desc };
          })
          .sort((a, b) => a.start.valueOf() - b.start.valueOf())
          .map((e) => ({
            ...e,
            id: `${e.start.unix()}-${e.end.unix()}-${e.vehicle}-${e.title}`,
          }));
        cache.set(key, parsed);
        setEvents(parsed);
      } catch (err) {
        if (!controller.signal.aborted) {
          logError(err, "RideVehicleCalendar:fetch");
          setError(err);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchEvents();
    return () => controller.abort();
  }, [date]);

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

  // ===== [RVTC:lanes:start] =====
  const groupedPacked = useMemo(() => {
    // Reuse filtered groups to respect vehicle filter
    return filteredGroups.map(({ vehicle, rides }) => {
      const lanes = packIntoLanes(rides);
      return { vehicle, lanes };
    });
  }, [filteredGroups]);
  // ===== [RVTC:lanes:end] =====

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
  const scrollRulerToNow = useCallback(() => {
    if (!rulerRef.current) return;
    if (!date.isSame(now, "day")) return;
    const container = rulerRef.current;
    const totalWidth = 24 * pxPerHour;
    const pct = clamp01(
      minutesBetween(date.startOf("day"), now) /
        minutesBetween(date.startOf("day"), date.endOf("day")),
    );
    const x = pct * totalWidth - container.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, x), behavior: "smooth" });
  }, [now, date, pxPerHour]);
  // ===== [RVTC:scrollH:end] =====

  const isToday = date.isSame(now, "day");
  const dayStart = date.startOf("day");
  const dayEnd = date.endOf("day");
  const nowPct = isToday
    ? (100 * minutesBetween(dayStart, now)) / minutesBetween(dayStart, dayEnd)
    : null;

  const selectedFromPrev = selectedEvent?.start?.isBefore(dayStart);
  const selectedIntoNext = selectedEvent?.end?.isAfter(dayEnd);

  useEffect(() => {
    if (!scrollToNowPref) return;
    if (!isToday) return;
    if (loading) return;
    scrollToNow();
    scrollRulerToNow();
  }, [scrollToNowPref, isToday, loading, scrollToNow, scrollRulerToNow]);

  useEffect(() => {
    const handleToday = () => {
      try {
        setDate(dayjs().tz(CST));
      } catch (err) {
        logError(err, { area: "CalendarHub", action: "today" });
      }
    };
    const handleCenterNow = () => {
      try {
        scrollToNow();
        scrollRulerToNow();
      } catch (err) {
        logError(err, { area: "CalendarHub", action: "center-now" });
      }
    };
    const handleExportCsv = () => {
      try {
        downloadCsv(flatFiltered, overlapsMap, date);
      } catch (err) {
        logError(err, { area: "CalendarHub", action: "export-csv" });
      }
    };
    const handleAddToCalendar = () => {
      try {
        downloadIcs(flatFiltered, date);
      } catch (err) {
        logError(err, { area: "CalendarHub", action: "add-to-calendar" });
      }
    };
    const handleShare = () => {
      try {
        shareDay(flatFiltered, date);
      } catch (err) {
        logError(err, { area: "CalendarHub", action: "share" });
      }
    };

    window.addEventListener("calendar:today", handleToday);
    window.addEventListener("calendar:center-now", handleCenterNow);
    window.addEventListener("calendar:export-csv", handleExportCsv);
    window.addEventListener("calendar:add-to-calendar", handleAddToCalendar);
    window.addEventListener("calendar:share", handleShare);

    return () => {
      window.removeEventListener("calendar:today", handleToday);
      window.removeEventListener("calendar:center-now", handleCenterNow);
      window.removeEventListener("calendar:export-csv", handleExportCsv);
      window.removeEventListener(
        "calendar:add-to-calendar",
        handleAddToCalendar,
      );
      window.removeEventListener("calendar:share", handleShare);
    };
  }, [scrollToNow, scrollRulerToNow, flatFiltered, overlapsMap, date]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <PageContainer>
        <Typography variant="h5" gutterBottom>
          🚖 Ride & Vehicle Calendar
        </Typography>

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

        <Stack
          direction={isMobile ? "column" : "row"}
          spacing={2}
          alignItems="center"
          mb={2}
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
                    color: option === "ALL" ? undefined : vehicleText[option],
                    fontWeight: 500,
                    "&:hover": {
                      backgroundColor:
                        option === "ALL" ? undefined : vehicleColors[option],
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
            sx={{ minWidth: 260 }}
          />
        </Stack>

        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            backgroundColor: theme.palette.background.default,
            borderBottom: 1,
            borderColor: "divider",
            py: 1,
            mb: 2,
          }}
        >
          <Stack
            direction={isMobile ? "column" : "row"}
            spacing={2}
            alignItems={isMobile ? "flex-start" : "center"}
            justifyContent="space-between"
          >
            <Typography fontSize={14}>
              {summary.rides} Rides • {summary.vehicles} Vehicles •{" "}
              {summary.tight} Tight Gaps • {summary.overlap} Overlaps
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button size="small" onClick={() => setDate(dayjs().tz(CST))}>
                Today
              </Button>
              <Button
                size="small"
                onClick={() => {
                  scrollToNow();
                  scrollRulerToNow();
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
        {/* ===== [RVTC:overview:start] ===== */}
        <Box
          sx={{
            mb: 2,
            borderRadius: 2,
            border: 1,
            borderColor: "divider",
            overflow: "hidden",
          }}
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
              <Button size="small" onClick={() => setShowOverview((v) => !v)}>
                {showOverview ? "Hide" : "Show"}
              </Button>
              <Button
                size="small"
                onClick={scrollRulerToNow}
                disabled={!isToday}
                title="Center now on the overview"
              >
                Center Now
              </Button>
            </Stack>
          </Stack>

          <Collapse in={showOverview} timeout="auto" unmountOnExit>
            {/* Hour ruler + lanes */}
            <Box
              ref={rulerRef}
              sx={{
                overflowX: "auto",
                overflowY: "hidden",
                WebkitOverflowScrolling: "touch",
                px: 1,
                pb: 1,
                bgcolor: theme.palette.background.paper,
              }}
            >
              {/* Ruler */}
              <Box
                sx={{
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  bgcolor: theme.palette.background.paper,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Box
                  sx={{
                    position: "relative",
                    // reserve the same gutter the lanes use so labels + bars align
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
                          height: 28,
                          borderLeft: i === 0 ? "none" : "1px dashed",
                          borderColor: "divider",
                          display: "flex",
                          alignItems: "center",
                          fontSize: 12,
                          color: "text.secondary",
                          pl: 0.75,
                        }}
                      >
                        {h.format("ha")}
                      </Box>
                    ))}
                  </Box>
                  {/* Now marker */}
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

              {/* Lanes per vehicle */}
              <Stack
                ref={lanesWrapperRef}
                sx={{ pt: 1, minWidth: `${gutter + 24 * pxPerHour}px` }}
                spacing={1}
              >
                {groupedPacked.map(({ vehicle, lanes }) => {
                  const rideCount = lanes.reduce((acc, l) => acc + l.length, 0);
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
                      {rideCount} rides
                    </Typography>
                  );

                  const anchoredPill =
                    stickyAnchorEl &&
                    createPortal(
                      <VehiclePillWrapper
                        width={labelW}
                        anchored
                        top={pillOffsets[vehicle] ?? 0}
                      >
                        {renderChip()}
                        {renderCount()}
                      </VehiclePillWrapper>,
                      stickyAnchorEl,
                    );

                  return (
                    <Box key={vehicle} sx={{ position: "relative" }}>
                      <VehiclePillWrapper
                        ref={setPillRef}
                        width={labelW}
                        hidden={Boolean(stickyAnchorEl)}
                      >
                        {renderChip()}
                        {renderCount()}
                      </VehiclePillWrapper>
                      {anchoredPill}

                      {/* Lanes shifted to clear the sticky label gutter */}
                      <Stack spacing={0.5} sx={{ pl: `${gutter}px` }}>
                        {lanes.map((lane, li) => (
                          <Box
                            key={li}
                            sx={{
                              position: "relative",
                              height: 22,
                              minWidth: `${24 * pxPerHour}px`,
                            }}
                          >
                            {lane.map((ev) => {
                              const { left, width } = percentSpan(
                                ev,
                                dayStart,
                                dayEnd,
                              );
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
                                      left: `${left}%`,
                                      width: `${width}%`,
                                      top: 0,
                                      bottom: 0,
                                      borderRadius: 1,
                                      bgcolor: `${vehicleColors[vehicle]}33`,
                                      border: `1px solid ${vehicleColors[vehicle]}`,
                                      transition: "transform 120ms ease",
                                      "&:hover": {
                                        transform: "translateY(-1px)",
                                      },
                                    }}
                                  />
                                </Tooltip>
                              );
                            })}
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          </Collapse>
        </Box>
        {/* ===== [RVTC:overview:end] ===== */}

        <Stack direction="row" spacing={1} mb={2}>
          <Button
            size="small"
            onClick={() => downloadCsv(flatFiltered, overlapsMap, date)}
            disabled={loading || !!error}
          >
            Export CSV
          </Button>
          <Button
            size="small"
            onClick={() => downloadIcs(flatFiltered, date)}
            disabled={loading || !!error}
          >
            Add to Calendar
          </Button>
          <Button
            size="small"
            onClick={() => shareDay(flatFiltered, date)}
            disabled={loading || !!error}
            startIcon={<ShareIcon fontSize="small" />}
          >
            Share
          </Button>
        </Stack>

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
            sx={{ mb: 2 }}
          >
            Failed to load rides.
          </Alert>
        )}

        {loading ? (
          <Stack spacing={compactMode ? 1 : 2}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Box
                key={i}
                sx={{
                  p: compactMode ? 1.25 : 2,
                  borderRadius: 2,
                  bgcolor:
                    theme.palette.mode === "dark" ? "#1e1e1e" : "#f8f8f8",
                }}
              >
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="rectangular" height={4} />
              </Box>
            ))}
          </Stack>
        ) : filteredGroups.length === 0 ? (
          <Typography>No rides scheduled for this date.</Typography>
        ) : (
          filteredGroups.map(({ vehicle, rides, total }) => {
            const expanded = sectionState[vehicle] !== false;
            return (
              <Box key={vehicle} mb={2}>
                <Chip
                  label={`${vehicle} • ${rides.length} • ${formatHm(total)}`}
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
                  <Stack spacing={compactMode ? 1 : 2}>
                    {rides.map((event) => {
                      const { left: startPct, width: widthPct } = percentSpan(
                        event,
                        dayStart,
                        dayEnd,
                      );
                      const endPct = startPct + widthPct;
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
                                width: `${endPct - startPct}%`,
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
                            {event.start.isBefore(dayStart) && (
                              <Chip
                                label="From Prev Day"
                                color="info"
                                size="small"
                              />
                            )}
                            {event.end.isAfter(dayEnd) && (
                              <Chip
                                label="Into Next Day"
                                color="info"
                                size="small"
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
            {(selectedFromPrev || selectedIntoNext) && (
              <Stack direction="row" spacing={1} mt={1}>
                {selectedFromPrev && (
                  <Chip label="From Previous Day" color="info" />
                )}
                {selectedIntoNext && (
                  <Chip label="Into Next Day" color="info" />
                )}
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
