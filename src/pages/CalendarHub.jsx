// [LRP:BEGIN:calendarHub]
/* Proprietary and confidential. See LICENSE. */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import {
  Box,
  Grid,
  Stack,
  Typography,
  Button,
  Divider,
  Tooltip,
  useMediaQuery,
  CircularProgress,
  Fab,
  Drawer,
  Switch,
  FormControlLabel,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import TodayIcon from "@mui/icons-material/Today";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import IosShareIcon from "@mui/icons-material/IosShare";
import EventIcon from "@mui/icons-material/Event";
import DownloadIcon from "@mui/icons-material/Download";
import dayjs from "dayjs";

import logError from "@/utils/logError.js";
import CalendarUpdateTab from "@/components/CalendarUpdateTab.jsx";
import {
  exportNodeToPng,
  buildICS,
  downloadICS,
  shareDeepLink,
} from "@/utils/calendarExport.js";

const STORAGE_KEY = "lrp.calendar.filters.v2";

// Idle chunk prefetch
let RideVehicleCalendarLazy = null;
const idlePrefetch = () => {
  const rIC =
    typeof window !== "undefined" && "requestIdleCallback" in window
      ? window.requestIdleCallback
      : (fn) => setTimeout(fn, 150);
  rIC(() => {
    import("@/components/RideVehicleCalendar.jsx")
      .then((m) => {
        RideVehicleCalendarLazy = m.default || m.RideVehicleCalendar || m;
      })
      .catch((e) =>
        logError(e, { area: "CalendarHub", action: "idle-prefetch" }),
      );
  });
};
idlePrefetch();

const LazyCalendar = lazy(async () => {
  if (RideVehicleCalendarLazy) {
    return { default: RideVehicleCalendarLazy };
  }
  const mod = await import("@/components/RideVehicleCalendar.jsx");
  const comp = mod.default || mod.RideVehicleCalendar || mod;
  RideVehicleCalendarLazy = comp;
  return { default: comp };
});

const useResolvedStickyTop = () => {
  const theme = useTheme();
  const isSmUp = useMediaQuery(theme.breakpoints.up("sm"));
  const APPBAR_MOBILE = 56;
  const APPBAR_DESKTOP = 64;
  const base = isSmUp ? APPBAR_DESKTOP : APPBAR_MOBILE;
  return `calc(${base}px + env(safe-area-inset-top, 0px))`;
};

export default function CalendarHub() {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
  const useDrawer = useMediaQuery(theme.breakpoints.down("lg"));
  const stickyTopCss = useResolvedStickyTop();

  const [filters, setFilters] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {
          vehicles: [],
          scrollToNow: true,
          showHeader: true,
        }
      );
    } catch (e) {
      logError(e, { area: "CalendarHub", action: "hydrate-filters" });
      return { vehicles: [], scrollToNow: true, showHeader: true };
    }
  });

  const calendarExportRef = useRef(null);

  // Persist (debounced)
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
      } catch (e) {
        logError(e, { area: "CalendarHub", action: "persist-filters" });
      }
    }, 140);
    return () => clearTimeout(id);
  }, [filters]);

  const [dateISO, setDateISO] = useState(() => dayjs().format("YYYY-MM-DD"));
  const [helpOpen, setHelpOpen] = useState(false);

  const deepLink = useMemo(() => {
    try {
      if (typeof window === "undefined") return "";
      const u = new URL(window.location.href);
      u.searchParams.set("date", dateISO);
      return u.toString();
    } catch (e) {
      logError(e, { area: "CalendarHub", action: "build-deeplink" });
      return "";
    }
  }, [dateISO]);

  const actions = useMemo(
    () => ({
      onToday: () => setDateISO(dayjs().format("YYYY-MM-DD")),
      onCenterNow: () =>
        window.dispatchEvent(new CustomEvent("calendar:center-now")),
    }),
    [],
  );

  // Auto center on load
  useEffect(() => {
    if (filters?.scrollToNow) {
      const id = setTimeout(() => actions.onCenterNow(), 250);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [filters?.scrollToNow, actions, dateISO]);

  // Hotkeys: T=Today, C=Center, ?=Help
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      const isEditing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);
      if (isEditing) return;
      if (e.key === "t" || e.key === "T") actions.onToday();
      if (e.key === "c" || e.key === "C") actions.onCenterNow();
      if (e.key === "?") setHelpOpen((v) => !v);
    };
    window.addEventListener("keyup", onKey);
    return () => window.removeEventListener("keyup", onKey);
  }, [actions]);

  /* Export handlers (data-safe even if child fetches internally) */
  const handleExportPng = useCallback(() => {
    exportNodeToPng(calendarExportRef.current, {
      fileBase: `LRP-calendar-${dateISO}`,
    });
  }, [dateISO]);

  const handleAddIcs = useCallback(() => {
    try {
      const items = Array.isArray(window.__LRP_DAYDATA)
        ? window.__LRP_DAYDATA
        : [];
      const ics = buildICS({ calendarName: `LRP — ${dateISO}`, items });
      downloadICS(ics, `LRP-${dateISO}`);
    } catch (e) {
      logError(e, { area: "CalendarHub", action: "addIcs" });
    }
  }, [dateISO]);

  const handleShare = useCallback(async () => {
    const ok = await shareDeepLink({
      url: deepLink,
      text: `LRP Ride & Vehicle Calendar — ${dateISO}`,
    });
    if (!ok) {
      // noop; copy fallback handled in util; could toast if you have a Snackbar util.
    }
  }, [deepLink, dateISO]);

  /* Hotkeys for Export (E), Add to Calendar (A), Share (S) */
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      const editing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);
      if (editing) return;
      if (e.key === "e" || e.key === "E") handleExportPng();
      if (e.key === "a" || e.key === "A") handleAddIcs();
      if (e.key === "s" || e.key === "S") handleShare();
    };
    window.addEventListener("keyup", onKey);
    return () => window.removeEventListener("keyup", onKey);
  }, [handleExportPng, handleAddIcs, handleShare]);

  return (
    <Box
      sx={{
        pt: 0,
        pb: `env(safe-area-inset-bottom, 0px)`,
        px: { xs: 1, sm: 2 },
      }}
    >
      <Box sx={{ maxWidth: 1280, mx: "auto", width: "100%" }}>
        {/* Sticky command bar */}
        <Box
          sx={{
            position: "sticky",
            top: stickyTopCss,
            zIndex: (t) => t.zIndex.appBar,
            pt: 0.5,
            pb: 1,
            background:
              theme.palette.mode === "dark"
                ? "rgba(6,6,6,0.9)"
                : theme.palette.background.paper,
            backdropFilter: "saturate(1.2) blur(6px)",
          }}
        >
          <Typography
            variant="h5"
            sx={{ fontWeight: 700, lineHeight: 1.2, mb: 1 }}
          >
            Ride &amp; Vehicle Calendar
          </Typography>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            rowGap={1}
          >
            <Button
              size="small"
              startIcon={<TodayIcon />}
              onClick={actions.onToday}
            >
              Today
            </Button>
            <Button
              size="small"
              startIcon={<CenterFocusStrongIcon />}
              onClick={actions.onCenterNow}
            >
              Center Now
            </Button>

            <FormControlLabel
              sx={{ ml: 1 }}
              label="Center on load"
              control={
                <Switch
                  checked={!!filters?.scrollToNow}
                  onChange={(_, v) =>
                    setFilters((p) => ({ ...p, scrollToNow: v }))
                  }
                />
              }
            />
            <FormControlLabel
              sx={{ ml: 1 }}
              label="Show header row"
              control={
                <Switch
                  checked={!!filters?.showHeader}
                  onChange={(_, v) =>
                    setFilters((p) => ({ ...p, showHeader: v }))
                  }
                />
              }
            />

            <Box sx={{ flexGrow: 1 }} />

            <Stack direction="row" spacing={1}>
              <Tooltip title="Export PNG (E)">
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={handleExportPng}
                >
                  Export
                </Button>
              </Tooltip>
              <Tooltip title="Add to Calendar (.ics) (A)">
                <Button
                  size="small"
                  startIcon={<EventIcon />}
                  onClick={handleAddIcs}
                >
                  Add to Calendar
                </Button>
              </Tooltip>
              <Tooltip title="Share / Copy (S)">
                <Button
                  size="small"
                  startIcon={<IosShareIcon />}
                  onClick={handleShare}
                >
                  Share
                </Button>
              </Tooltip>
            </Stack>

            <Tooltip title="How to mark yourself unavailable (Google Calendar + Moovs)">
              <Button
                size="small"
                onClick={() => setHelpOpen(true)}
                startIcon={<HelpOutlineIcon />}
              >
                Availability Help
              </Button>
            </Tooltip>
          </Stack>
        </Box>

        {!isMdUp && <Divider sx={{ my: 2 }} />}

        <Grid container spacing={2}>
          <Grid item xs={12} md={8} ref={calendarExportRef}>
            <Suspense
              fallback={
                <Box
                  sx={{
                    py: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CircularProgress size={32} />
                </Box>
              }
            >
              <LazyCalendar
                dateISO={dateISO}
                data={
                  undefined /* your component can still fetch internally if needed */
                }
                hideHeader={!filters?.showHeader}
                stickyTopOffset={stickyTopCss}
                onCenterNow={filters?.scrollToNow ? "init" : undefined}
              />
            </Suspense>
          </Grid>

          <Grid
            item
            xs={12}
            xl={4}
            sx={{ display: { xs: "none", xl: "block" } }}
          >
            {!useDrawer && <CalendarUpdateTab compact />}
          </Grid>
        </Grid>
      </Box>

      {/* Help Drawer */}
      <Drawer
        anchor="right"
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            mt: {
              xs: `calc(56px + env(safe-area-inset-top, 0px))`,
              sm: `calc(64px + env(safe-area-inset-top, 0px))`,
            },
            height: {
              xs: `calc(100% - calc(56px + env(safe-area-inset-top, 0px)))`,
              sm: `calc(100% - calc(64px + env(safe-area-inset-top, 0px)))`,
            },
            width: { xs: "94vw", sm: 420 },
            overflow: "auto",
            pt: 1,
          },
        }}
      >
        <Box sx={{ px: 2, pb: 2 }}>
          <CalendarUpdateTab compact />
        </Box>
      </Drawer>

      {/* Mobile reach FABs */}
      <Tooltip title="Today">
        <Fab
          size="medium"
          color="primary"
          onClick={actions.onToday}
          sx={{
            position: "fixed",
            right: 16,
            bottom: `calc(88px + env(safe-area-inset-bottom, 0px))`,
            zIndex: (t) => t.zIndex.tooltip + 1,
            backgroundColor: "#4cbb17",
            "&:hover": { backgroundColor: "#3ea313" },
          }}
          aria-label="Jump to today"
        >
          <TodayIcon />
        </Fab>
      </Tooltip>

      <Tooltip title="Center to now">
        <Fab
          size="medium"
          color="primary"
          onClick={actions.onCenterNow}
          sx={{
            position: "fixed",
            right: 16,
            bottom: `calc(24px + env(safe-area-inset-bottom, 0px))`,
            zIndex: (t) => t.zIndex.tooltip + 1,
            backgroundColor: "#4cbb17",
            "&:hover": { backgroundColor: "#3ea313" },
          }}
          aria-label="Center to current time"
        >
          <CenterFocusStrongIcon />
        </Fab>
      </Tooltip>
    </Box>
  );
}
// [LRP:END:calendarHub]
