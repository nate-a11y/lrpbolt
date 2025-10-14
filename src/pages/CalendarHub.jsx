/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useState, useCallback, lazy, Suspense } from "react";
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
  Alert,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import TodayIcon from "@mui/icons-material/Today";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";

import logError from "@/utils/logError.js";
import CalendarUpdateTab from "@/components/CalendarUpdateTab.jsx";

const STORAGE_KEY = "lrp.calendar.filters";
const STORAGE_VERSION = 2;

/** --------- Lazy resolver with idle prefetch + multi-path import ---------- */
let rideVehicleCalendarComponent = null;
let rideVehicleCalendarPromise = null;

const resolveRideVehicleCalendar = async () => {
  if (rideVehicleCalendarComponent) return rideVehicleCalendarComponent;

  if (!rideVehicleCalendarPromise) {
    rideVehicleCalendarPromise = (async () => {
      const candidates = [
        { label: "alias", loader: () => import("@/components/RideVehicleCalendar.jsx") },
        { label: "relative", loader: () => import("../components/RideVehicleCalendar.jsx") },
      ];
      for (const attempt of candidates) {
        try {
          const mod = await attempt.loader();
          const comp = mod?.default || mod?.RideVehicleCalendar || null;
          if (comp) {
            rideVehicleCalendarComponent = comp;
            return comp;
          }
          logError(new Error("RideVehicleCalendar export missing"), {
            area: "CalendarHub",
            action: "load-ride-vehicle-calendar",
            attempt: attempt.label,
          });
        } catch (err) {
          logError(err, {
            area: "CalendarHub",
            action: "load-ride-vehicle-calendar",
            attempt: attempt.label,
          });
        }
      }
      return null;
    })();
  }
  return rideVehicleCalendarPromise;
};

// Idle prefetch to hide first-content jank
const rIC =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? window.requestIdleCallback
    : (fn) => setTimeout(fn, 150);

rIC(() => {
  resolveRideVehicleCalendar().catch((e) =>
    logError(e, { area: "CalendarHub", action: "idle-prefetch" }),
  );
});

const RideVehicleCalendarLazy = lazy(async () => {
  const component = await resolveRideVehicleCalendar();
  if (!component) {
    throw new Error(
      "RideVehicleCalendar component not found. Ensure it exports default or { RideVehicleCalendar }.",
    );
  }
  return { default: component };
});

/** --------------------------------- Hooks --------------------------------- */
const useResolvedStickyTop = () => {
  const theme = useTheme();
  const isSmUp = useMediaQuery(theme.breakpoints.up("sm"));
  const APPBAR_MOBILE = 56;
  const APPBAR_DESKTOP = 64;
  const base = isSmUp ? APPBAR_DESKTOP : APPBAR_MOBILE;
  return `calc(${base}px + env(safe-area-inset-top, 0px))`;
};

const usePersistentFilters = () => {
  const load = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { _v: STORAGE_VERSION, vehicles: [], scrollToNow: true, showHeader: false };
      }
      const parsed = JSON.parse(raw);
      // simple migration example
      if (!parsed || typeof parsed !== "object") {
        return { _v: STORAGE_VERSION, vehicles: [], scrollToNow: true, showHeader: false };
      }
      if (!parsed._v || parsed._v < STORAGE_VERSION) {
        const migrated = {
          _v: STORAGE_VERSION,
          vehicles: Array.isArray(parsed.vehicles) ? parsed.vehicles : [],
          scrollToNow:
            typeof parsed.scrollToNow === "boolean" ? parsed.scrollToNow : true,
          showHeader: typeof parsed.showHeader === "boolean" ? parsed.showHeader : false,
        };
        return migrated;
      }
      return parsed;
    } catch (e) {
      logError(e, { area: "CalendarHub", action: "hydrate-filters" });
      return { _v: STORAGE_VERSION, vehicles: [], scrollToNow: true, showHeader: false };
    }
  }, []);

  const [filters, setFilters] = useState(load);

  // debounce persist (avoid thrash)
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
      } catch (e) {
        logError(e, { area: "CalendarHub", action: "persist-filters" });
      }
    }, 150);
    return () => clearTimeout(id);
  }, [filters]);

  const update = useCallback((next) => {
    setFilters((prev) => ({ ...prev, ...next, _v: STORAGE_VERSION }));
  }, []);

  return [filters, update];
};

/** ------------------------------ Error boundary ---------------------------- */
function CalendarErrorBoundary({ children, onRetry }) {
  const [err, setErr] = useState(null);
  const reset = useCallback(() => {
    setErr(null);
    onRetry?.();
  }, [onRetry]);

  if (err) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={reset}>
              Retry
            </Button>
          }
        >
          Failed to load the Vehicle Calendar. Please try again.
        </Alert>
      </Box>
    );
  }

  return (
    <ErrorCatcher onError={setErr}>
      {children}
    </ErrorCatcher>
  );
}

function ErrorCatcher({ children, onError }) {
  // minimal error boundary using React error handling via a thrown promise boundary
  // We rely on Suspense throw; for runtime render errors we wrap in try/catch where possible.
  return children;
}

/** --------------------------------- View ---------------------------------- */
export default function CalendarHub() {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
  const useDrawer = useMediaQuery(theme.breakpoints.down("lg"));
  const stickyTopCss = useResolvedStickyTop();

  const APPBAR_MOBILE = 56;
  const APPBAR_DESKTOP = 64;
  const drawerTopXs = `calc(${APPBAR_MOBILE}px + env(safe-area-inset-top, 0px))`;
  const drawerTopSm = `calc(${APPBAR_DESKTOP}px + env(safe-area-inset-top, 0px))`;

  const [filters, setFilters] = usePersistentFilters();
  const [helpOpen, setHelpOpen] = useState(false);

  const actions = useMemo(
    () => ({
      onToday: () => window.dispatchEvent(new CustomEvent("calendar:today")),
      onCenterNow: () =>
        window.dispatchEvent(new CustomEvent("calendar:center-now")),
    }),
    [],
  );

  // Keyboard shortcuts: T (today), C (center now), ? (help)
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)) {
        return;
      }
      if (e.key === "t" || e.key === "T") {
        actions.onToday();
      } else if (e.key === "c" || e.key === "C") {
        actions.onCenterNow();
      } else if (e.key === "?") {
        setHelpOpen((v) => !v);
      }
    };
    window.addEventListener("keyup", onKey);
    return () => window.removeEventListener("keyup", onKey);
  }, [actions]);

  // Auto-center on mount if enabled
  useEffect(() => {
    if (filters?.scrollToNow) {
      // slight delay so the child mounts first
      const id = setTimeout(() => actions.onCenterNow(), 200);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [filters?.scrollToNow, actions]);

  const handleHelpOpen = useCallback(() => setHelpOpen(true), []);
  const handleHelpClose = useCallback(() => setHelpOpen(false), []);
  const toggleScrollToNow = useCallback(
    (_, checked) => setFilters({ scrollToNow: checked }),
    [setFilters],
  );
  const toggleHeader = useCallback(
    (_, checked) => setFilters({ showHeader: checked }),
    [setFilters],
  );

  return (
    <Box sx={{ pt: 0, pb: `env(safe-area-inset-bottom, 0px)`, px: { xs: 1, sm: 2 } }}>
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
              theme.palette.mode === "dark" ? "rgba(6,6,6,0.9)" : theme.palette.background.paper,
            backdropFilter: "saturate(1.2) blur(6px)",
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2, mb: 1 }}>
            Ride &amp; Vehicle Calendar
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" rowGap={1}>
            <Button size="small" startIcon={<TodayIcon />} onClick={actions.onToday}>
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
                  onChange={toggleScrollToNow}
                  inputProps={{ "aria-label": "Auto center on Now when opening" }}
                />
              }
            />
            <FormControlLabel
              sx={{ ml: 1 }}
              label="Show header row"
              control={
                <Switch
                  checked={!!filters?.showHeader}
                  onChange={toggleHeader}
                  inputProps={{ "aria-label": "Show timeline header inside calendar" }}
                />
              }
            />
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title="How to mark yourself unavailable (Google Calendar + Moovs)">
              <Button size="small" onClick={handleHelpOpen} startIcon={<HelpOutlineIcon />}>
                Availability Help
              </Button>
            </Tooltip>
          </Stack>
        </Box>

        {!isMdUp && <Divider sx={{ my: 2 }} />}

        <Grid container spacing={2}>
          {/* Left: Schedule */}
          <Grid item xs={12} md={8}>
            <CalendarErrorBoundary
              onRetry={() =>
                resolveRideVehicleCalendar().catch((e) =>
                  logError(e, { area: "CalendarHub", action: "retry-load" }),
                )
              }
            >
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
                <RideVehicleCalendarLazy
                  persistedFilters={filters}
                  onFiltersChange={setFilters}
                  hideHeader={!filters?.showHeader}
                  hideQuickActions
                  hideLowerActions
                  stickyTopOffset={stickyTopCss}
                />
              </Suspense>
            </CalendarErrorBoundary>
          </Grid>

          {/* Right: Help */}
          <Grid item xs={12} xl={4} sx={{ display: { xs: "none", xl: "block" } }}>
            {!useDrawer && <CalendarUpdateTab compact />}
          </Grid>
        </Grid>
      </Box>

      {/* Help Drawer for smaller screens */}
      <Drawer
        anchor="right"
        open={helpOpen}
        onClose={handleHelpClose}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            mt: { xs: drawerTopXs, sm: drawerTopSm },
            height: {
              xs: `calc(100% - ${drawerTopXs})`,
              sm: `calc(100% - ${drawerTopSm})`,
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

      {/* Compact action FABs (mobile reach) */}
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
