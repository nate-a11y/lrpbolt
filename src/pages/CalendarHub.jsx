// [LRP:BEGIN:calendarHub:defaults-only]
/* Proprietary and confidential. See LICENSE. */
// allow-color-literal-file

import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import {
  Box,
  Grid,
  Stack,
  Typography,
  Button,
  Divider,
  Tooltip,
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

import useMediaQuery from "@/hooks/useMediaQuery.js";
import dayjs from "@/utils/dayjsSetup.js";
import logError from "@/utils/logError.js";
import CalendarUpdateTab from "@/components/CalendarUpdateTab.jsx";

const STORAGE_KEY = "lrp.calendar.filters.v2";
const LazyCalendar = lazy(() => import("@/components/RideVehicleCalendar.jsx"));

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
          showHeader: true, // default ON
        }
      );
    } catch (e) {
      logError(e, { area: "CalendarHub", action: "hydrate-filters" });
      return { vehicles: [], scrollToNow: true, showHeader: true };
    }
  });

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

  const actions = useMemo(
    () => ({
      onToday: () => setDateISO(dayjs().format("YYYY-MM-DD")),
      onCenterNow: () =>
        window.dispatchEvent(new CustomEvent("calendar:center-now")),
    }),
    [],
  );

  useEffect(() => {
    if (filters?.scrollToNow) {
      const id = setTimeout(() => actions.onCenterNow(), 250);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [filters?.scrollToNow, actions, dateISO]);

  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      const editing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);
      if (editing) return;
      if (e.key === "t" || e.key === "T") actions.onToday();
      if (e.key === "c" || e.key === "C") actions.onCenterNow();
      if (e.key === "?") setHelpOpen((v) => !v);
    };
    window.addEventListener("keyup", onKey);
    return () => window.removeEventListener("keyup", onKey);
  }, [actions]);

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
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            📅 Ride &amp; Vehicle Calendar
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
          <Grid item xs={12} md={8}>
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
            backgroundColor: (t) => t.palette.primary.main,
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
            backgroundColor: (t) => t.palette.primary.main,
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
// [LRP:END:calendarHub:defaults-only]
