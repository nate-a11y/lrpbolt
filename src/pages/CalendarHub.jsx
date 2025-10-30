// [LRP:BEGIN:calendarHub:defaults-only]
/* Proprietary and confidential. See LICENSE. */

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
import { useTheme, alpha } from "@mui/material/styles";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers-pro";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
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
  const stickyTopCss = useResolvedStickyTop();

  const [filters, setFilters] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {
          vehicles: [],
          scrollToNow: true,
        }
      );
    } catch (e) {
      logError(e, { area: "CalendarHub", action: "hydrate-filters" });
      return { vehicles: [], scrollToNow: true };
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
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          pt: 0,
          pb: `env(safe-area-inset-bottom, 0px)`,
          px: { xs: 2, md: 3 },
          color: "text.primary",
        }}
      >
        <Box sx={{ maxWidth: 1280, mx: "auto", width: "100%" }}>
          {/* Sticky command bar */}
          <Box
            sx={{
              position: "sticky",
              top: stickyTopCss,
              zIndex: (t) => t.zIndex.appBar,
              py: 2,
              background:
                theme.palette.mode === "dark"
                  ? alpha(theme.palette.background.default, 0.95)
                  : alpha(theme.palette.background.paper, 0.95),
              backdropFilter: "saturate(1.2) blur(12px)",
              mb: 2,
              borderBottom: (t) => `1px solid ${alpha(t.palette.divider, 0.1)}`,
            }}
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                📅 Ride &amp; Vehicle Calendar
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                View and manage ride schedules, vehicle availability, and driver assignments
              </Typography>
            </Box>

            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ rowGap: 1.5 }}
            >
              <DatePicker
                value={dayjs(dateISO)}
                onChange={(newDate) => {
                  if (newDate) {
                    setDateISO(newDate.format("YYYY-MM-DD"));
                  }
                }}
                slotProps={{
                  textField: {
                    size: "small",
                    sx: {
                      minWidth: 140,
                      "& .MuiOutlinedInput-root": {
                        bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
                        transition: "all 0.2s ease",
                        "&:hover": {
                          bgcolor: (t) => t.palette.background.paper,
                          boxShadow: (t) => `0 2px 8px ${alpha(t.palette.common.black, 0.1)}`,
                        },
                      },
                    },
                  },
                }}
              />
              <Button
                size="small"
                variant="outlined"
                startIcon={<TodayIcon />}
                onClick={actions.onToday}
                sx={{
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
                  borderColor: (t) => t.palette.divider,
                  fontWeight: 600,
                  transition: "all 0.2s ease",
                  "&:hover": {
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                    borderColor: (t) => t.palette.primary.main,
                    transform: "translateY(-1px)",
                    boxShadow: (t) => `0 2px 8px ${alpha(t.palette.primary.main, 0.2)}`,
                  },
                }}
              >
                Today
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CenterFocusStrongIcon />}
                onClick={actions.onCenterNow}
                sx={{
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
                  borderColor: (t) => t.palette.divider,
                  fontWeight: 600,
                  transition: "all 0.2s ease",
                  "&:hover": {
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                    borderColor: (t) => t.palette.primary.main,
                    transform: "translateY(-1px)",
                    boxShadow: (t) => `0 2px 8px ${alpha(t.palette.primary.main, 0.2)}`,
                  },
                }}
              >
                Center Now
              </Button>

              <FormControlLabel
                sx={{
                  ml: { xs: 0, sm: 1 },
                  "& .MuiFormControlLabel-label": {
                    fontSize: "0.875rem",
                    fontWeight: 500,
                  },
                }}
                label="Center on load"
                control={
                  <Switch
                    checked={!!filters?.scrollToNow}
                    onChange={(_, v) =>
                      setFilters((p) => ({ ...p, scrollToNow: v }))
                    }
                    sx={{
                      "& .MuiSwitch-switchBase.Mui-checked": {
                        color: (t) => t.palette.primary.main,
                      },
                      "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                        bgcolor: (t) => t.palette.primary.main,
                      },
                    }}
                  />
                }
              />

              <Box sx={{ flexGrow: 1 }} />

              <Tooltip title="How to mark yourself unavailable (Google Calendar + Moovs)">
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => setHelpOpen(true)}
                  startIcon={<HelpOutlineIcon />}
                  sx={{
                    bgcolor: (t) => t.palette.primary.main,
                    fontWeight: 600,
                    boxShadow: (t) => `0 2px 8px ${alpha(t.palette.primary.main, 0.3)}`,
                    transition: "all 0.2s ease",
                    "&:hover": {
                      bgcolor: (t) => t.palette.primary.dark,
                      transform: "translateY(-1px)",
                      boxShadow: (t) => `0 4px 12px ${alpha(t.palette.primary.main, 0.4)}`,
                    },
                  }}
                >
                  {isMdUp ? "Availability Help" : "Help"}
                </Button>
              </Tooltip>
            </Stack>
          </Box>

          {!isMdUp && <Divider sx={{ my: 2 }} />}

          <Grid container spacing={2}>
            <Grid item xs={12}>
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
                  onDateChange={setDateISO}
                  hideHeader={true}
                  hideDatePicker={true}
                  stickyTopOffset={stickyTopCss}
                  onCenterNow={filters?.scrollToNow ? "init" : undefined}
                  hideQuickActions={!isMdUp}
                  persistedFilters={filters}
                  onFiltersChange={setFilters}
                />
              </Suspense>
            </Grid>
            {/* Availability Help sidebar removed - now only available via drawer (Help button) */}
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
        <Tooltip title="Jump to today's date">
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
              boxShadow: (t) => `0 4px 16px ${alpha(t.palette.primary.main, 0.4)}`,
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                backgroundColor: (t) => t.palette.primary.dark,
                transform: "scale(1.1)",
                boxShadow: (t) => `0 6px 20px ${alpha(t.palette.primary.main, 0.5)}`,
              },
              "&:active": {
                transform: "scale(0.95)",
              },
            }}
            aria-label="Jump to today"
          >
            <TodayIcon />
          </Fab>
        </Tooltip>

        <Tooltip title="Center calendar to current time">
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
              boxShadow: (t) => `0 4px 16px ${alpha(t.palette.primary.main, 0.4)}`,
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                backgroundColor: (t) => t.palette.primary.dark,
                transform: "scale(1.1)",
                boxShadow: (t) => `0 6px 20px ${alpha(t.palette.primary.main, 0.5)}`,
              },
              "&:active": {
                transform: "scale(0.95)",
              },
            }}
            aria-label="Center to current time"
          >
            <CenterFocusStrongIcon />
          </Fab>
        </Tooltip>
      </Box>
    </LocalizationProvider>
  );
}
// [LRP:END:calendarHub:defaults-only]
