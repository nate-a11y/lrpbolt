/* Proprietary and confidential. See LICENSE. */
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  lazy,
  Suspense,
} from "react";
import {
  Box,
  Grid,
  Stack,
  Typography,
  IconButton,
  Button,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Tooltip,
  useMediaQuery,
  CircularProgress,
} from "@mui/material";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ShareIcon from "@mui/icons-material/Share";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import TodayIcon from "@mui/icons-material/Today";
import { styled, useTheme } from "@mui/material/styles";

import { dayjs } from "@/utils/time";
import logError from "@/utils/logError.js";

const LRP = { green: "#4cbb17" };
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

const StickyPill = styled("div")(({ theme }) => ({
  position: "sticky",
  left: 0,
  zIndex: theme.zIndex.appBar,
  backgroundColor: theme.palette.background.default,
  paddingRight: theme.spacing(1),
  display: "inline-flex",
  alignItems: "center",
}));

export default function CalendarHub() {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
  const [filters, setFilters] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { vehicles: [], scrollToNow: true };
    } catch (e) {
      logError(e, { area: "CalendarHub", action: "hydrate-filters" });
      return { vehicles: [], scrollToNow: true };
    }
  });
  const [helpOpen, setHelpOpen] = useState(isMdUp);

  useEffect(() => {
    if (isMdUp) {
      setHelpOpen(true);
    }
  }, [isMdUp]);

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
      onExportCsv: () =>
        window.dispatchEvent(new CustomEvent("calendar:export-csv")),
      onAddToCalendar: () =>
        window.dispatchEvent(new CustomEvent("calendar:add-to-calendar")),
      onShare: () => window.dispatchEvent(new CustomEvent("calendar:share")),
    }),
    [],
  );

  const handleToggleHelp = useCallback(() => {
    setHelpOpen((prev) => !prev);
  }, []);

  const todayLabel = useMemo(() => dayjs().format("MMM D, YYYY"), []);
  // Optional: expose callbacks for the Quick Actions row if RideVehicleCalendar doesn't already

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, py: 2 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Ride & Vehicle Calendar
          </Typography>
          {isMdUp ? (
            <Tooltip title="Availability & Moovs help is on the right">
              <HelpOutlineIcon sx={{ color: LRP.green }} />
            </Tooltip>
          ) : (
            <Tooltip
              title={
                helpOpen
                  ? "Hide Availability & Moovs help"
                  : "Show Availability & Moovs help"
              }
            >
              <IconButton
                size="small"
                onClick={handleToggleHelp}
                aria-label="Toggle availability help"
                aria-controls="calendar-help-panel"
                aria-expanded={helpOpen}
              >
                <HelpOutlineIcon sx={{ color: LRP.green }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              display: { xs: "none", sm: "inline-flex" },
            }}
          >
            {todayLabel}
          </Typography>
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
          <Button
            size="small"
            startIcon={<FileDownloadIcon />}
            onClick={actions.onExportCsv}
          >
            Export CSV
          </Button>
          <Button
            size="small"
            startIcon={<CalendarMonthIcon />}
            onClick={actions.onAddToCalendar}
          >
            Add to Calendar
          </Button>
          <Button
            size="small"
            startIcon={<ShareIcon />}
            onClick={actions.onShare}
          >
            Share
          </Button>
        </Stack>
      </Stack>

      {!isMdUp && <Divider sx={{ my: 2 }} />}

      <Grid container spacing={2}>
        {/* Left: Schedule */}
        <Grid item xs={12} md={8}>
          {/* Sticky vehicle pill wrapper: RideVehicleCalendar should render its pill inside this slot when possible */}
          <StickyPill id="sticky-vehicle-pill-anchor" />
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
            />
          </Suspense>
        </Grid>

        {/* Right: Help */}
        {(isMdUp || helpOpen) && (
          <Grid item xs={12} md={4}>
            <Stack spacing={2} id="calendar-help-panel">
              <Stack direction="row" spacing={1} alignItems="center">
                <MenuBookIcon sx={{ color: LRP.green }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  How to Mark Yourself Unavailable
                </Typography>
              </Stack>
              <Alert severity="info">
                Quick tip: Update <strong>both</strong> Google Calendar and
                Moovs so dispatch knows when you’re out.
              </Alert>

              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Step 1: Google Calendar</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1}>
                    <Typography>
                      Create an event titled:{" "}
                      <strong>Your Name — Not Available</strong>
                    </Typography>
                    <Typography>
                      Select the date/time or mark <strong>All Day</strong>.
                    </Typography>
                    <Typography>
                      Use <strong>Repeat</strong> if this recurs.
                    </Typography>
                    <Typography>
                      Tap <strong>Save</strong>.
                    </Typography>
                  </Stack>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Step 2: Block Time in Moovs</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1}>
                    <Typography>Open Moovs &gt; Availability.</Typography>
                    <Typography>
                      Block the same dates/times to prevent dispatch overlap.
                    </Typography>
                    <Typography>Confirm changes.</Typography>
                  </Stack>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Bonus: Duplicate Days Off</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1}>
                    <Typography>
                      In Google Calendar, duplicate your “Not Available” event
                      and set the new dates.
                    </Typography>
                    <Typography>Mirror those in Moovs.</Typography>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Stack>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
