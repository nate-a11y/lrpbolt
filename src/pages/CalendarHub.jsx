/* Proprietary and confidential. See LICENSE. */
import { useMemo, useState, useCallback, lazy, Suspense } from "react";
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
} from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import TodayIcon from "@mui/icons-material/Today";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";

import logError from "@/utils/logError.js";
import CalendarUpdateTab from "@/components/CalendarUpdateTab.jsx";
const STORAGE_KEY = "lrp.calendar.filters";

let rideVehicleCalendarComponent = null;
let rideVehicleCalendarPromise = null;

const resolveRideVehicleCalendar = async () => {
  if (rideVehicleCalendarComponent) {
    return rideVehicleCalendarComponent;
  }

  if (!rideVehicleCalendarPromise) {
    rideVehicleCalendarPromise = (async () => {
      const attempts = [
        {
          label: "alias",
          loader: () => import("@/components/RideVehicleCalendar.jsx"),
        },
        {
          label: "relative",
          loader: () => import("../components/RideVehicleCalendar.jsx"),
        },
      ];

      for (const attempt of attempts) {
        try {
          const module = await attempt.loader();
          const component =
            module?.default || module?.RideVehicleCalendar || null;
          if (component) {
            rideVehicleCalendarComponent = component;
            return component;
          }
          logError(new Error("RideVehicleCalendar export missing"), {
            area: "CalendarHub",
            action: "load-ride-vehicle-calendar",
            attempt: attempt.label,
          });
        } catch (error) {
          logError(error, {
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

const RideVehicleCalendarLazy = lazy(async () => {
  const component = await resolveRideVehicleCalendar();
  if (!component) {
    throw new Error(
      "RideVehicleCalendar component not found. Ensure it exports default or { RideVehicleCalendar }.",
    );
  }
  return { default: component };
});

const StickyPill = styled(Box)(({ theme }) => ({
  position: "sticky",
  left: 0,
  zIndex: theme.zIndex.appBar,
  backgroundColor: theme.palette.background.default,
  paddingRight: theme.spacing(1),
  display: "inline-flex",
  alignItems: "center",
}));

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
  const APPBAR_MOBILE = 56;
  const APPBAR_DESKTOP = 64;
  const drawerTopXs = `calc(${APPBAR_MOBILE}px + env(safe-area-inset-top, 0px))`;
  const drawerTopSm = `calc(${APPBAR_DESKTOP}px + env(safe-area-inset-top, 0px))`;
  const [filters, setFilters] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { vehicles: [], scrollToNow: true };
    } catch (e) {
      logError(e, { area: "CalendarHub", action: "hydrate-filters" });
      return { vehicles: [], scrollToNow: true };
    }
  });
  const [helpOpen, setHelpOpen] = useState(false);

  const handleFiltersChange = useCallback((next) => {
    setFilters((prev) => {
      const merged = { ...prev, ...next };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch (e) {
        logError(e, { area: "CalendarHub", action: "persist-filters" });
      }
      return merged;
    });
  }, []);

  const actions = useMemo(
    () => ({
      onToday: () => window.dispatchEvent(new CustomEvent("calendar:today")),
      onCenterNow: () =>
        window.dispatchEvent(new CustomEvent("calendar:center-now")),
    }),
    [],
  );

  const handleHelpOpen = useCallback(() => {
    setHelpOpen(true);
  }, []);

  const handleHelpClose = useCallback(() => {
    setHelpOpen(false);
  }, []);

  return (
    <Box
      sx={{
        pt: 0,
        pb: `env(safe-area-inset-bottom, 0px)`,
        px: { xs: 1, sm: 2 },
      }}
    >
      <Box sx={{ maxWidth: 1280, mx: "auto", width: "100%" }}>
        <Box sx={{ mb: 1 }}>
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
              Scroll to Now
            </Button>
          </Stack>
        </Box>

        {!isMdUp && <Divider sx={{ my: 2 }} />}

        <Grid container spacing={2}>
          {/* Left: Schedule */}
          <Grid item xs={12} md={8}>
            {/* Sticky vehicle pill wrapper: RideVehicleCalendar should render its pill inside this slot when possible */}
            <StickyPill
              id="sticky-vehicle-pill-anchor"
              sx={{ top: stickyTopCss }}
            />
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
                onFiltersChange={handleFiltersChange}
                stickyPillAnchorId="sticky-vehicle-pill-anchor"
                hideHeader
                hideQuickActions
                hideLowerActions
                stickyTopOffset={stickyTopCss}
              />
            </Suspense>
          </Grid>

          {/* Right: Help */}
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

      <Tooltip title="How to mark yourself unavailable (Google Calendar + Moovs)">
        <Fab
          variant="extended"
          color="primary"
          aria-label="Open availability help"
          onClick={handleHelpOpen}
          sx={{
            position: "fixed",
            right: 16,
            bottom: `calc(16px + env(safe-area-inset-bottom, 0px))`,
            zIndex: (t) => t.zIndex.tooltip + 1,
            backgroundColor: "#4cbb17",
            "&:hover": { backgroundColor: "#3ea313" },
            px: { xs: 2, sm: 3 },
          }}
        >
          <HelpOutlineIcon sx={{ mr: { xs: 0, sm: 1 } }} />
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
            Availability Help
          </Box>
        </Fab>
      </Tooltip>

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
    </Box>
  );
}
