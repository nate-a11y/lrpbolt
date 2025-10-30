/* Proprietary and confidential. See LICENSE. */
// src/components/RideEntryForm.jsx
import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import AddIcon from "@mui/icons-material/Add";
import DirectionsCar from "@mui/icons-material/DirectionsCar";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import { LocalizationProvider, DateTimePicker } from "@mui/x-date-pickers-pro";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import Papa from "papaparse";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import LrpSelectField from "@/components/inputs/LrpSelectField";
import { TRIP_STATES } from "@/constants/tripStates.js";
import { useTripsByState } from "@/hooks/useTripsByState.js";

import { dayjs, toDayjs, formatDateTime, durationSafe } from "../utils/time.js";
import { formatTripId, isTripIdValid } from "../utils/formatters";
import { RIDE_TYPES, VEHICLES } from "../constants/rides";
import { COLLECTIONS } from "../constants";
import { db } from "../utils/firebaseInit";
import {
  getRideTemplateCsv,
  rideCsvTemplateHeaders,
} from "../utils/csvTemplates";
import { withExponentialBackoff } from "../services/retry";
import { AppError, logError } from "../services/errors";
import { safeGet } from "../services/q.js";
import { callDropDailyRidesNow } from "../utils/functions";
import { useDriver } from "../context/DriverContext.jsx";
import useAuth from "../hooks/useAuth.js";
import useMediaQuery from "../hooks/useMediaQuery";

const LiveRidesGrid = lazy(() => import("./LiveRidesGrid.jsx"));
const RideQueueGrid = lazy(() => import("./RideQueueGrid.jsx"));
const ClaimedRidesGrid = lazy(() => import("./ClaimedRidesGrid.jsx"));
import DropDailyWidget from "./DropDailyWidget";
import ResponsiveContainer from "./responsive/ResponsiveContainer.jsx";

const TAB_STORAGE_KEY = "lrp:rideentry:tab";
const DRAFT_STORAGE_KEY = "lrp:rideentry:draft";
const DRAFT_ALERT_KEY = "lrp:rideentry:draft:alerted";
const CHUNK_SIZE = 400;
const DEFAULT_DURATION_MINUTES = 45;

const SINGLE_DEFAULT = {
  tripId: "",
  pickupAt: null,
  rideType: "",
  vehicle: "",
  durationHours: "",
  durationMinutes: "",
  notes: "",
};

const BUILDER_DEFAULT = {
  tripId: "",
  pickupAt: null,
  rideType: "",
  vehicle: "",
  durationHours: "",
  durationMinutes: "",
  notes: "",
};

const SECTION_PAPER_SX = {
  borderRadius: 2,
  p: { xs: 1.5, sm: 2.5 },
  bgcolor: (theme) =>
    theme.palette.mode === "dark"
      ? theme.palette.background.default
      : theme.palette.background.paper,
  display: "flex",
  flexDirection: "column",
  gap: { xs: 1.5, sm: 2 },
};

const GRID_SPACING = { xs: 1.5, sm: 2 };

const MODERN_CARD_SX = {
  position: "relative",
  borderRadius: 4,
  overflow: "visible",
  background: (t) =>
    `linear-gradient(135deg, ${t.palette.mode === "dark" ? "rgba(76,187,23,0.08)" : "rgba(76,187,23,0.04)"}, ${t.palette.background.paper})`,
  border: "1px solid",
  borderColor: (t) =>
    t.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
  transition: "all 0.3s ease",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    borderRadius: 4,
    padding: "1px",
    pointerEvents: "none",
    background: (t) =>
      `linear-gradient(90deg, ${t.palette.mode === "dark" ? "rgba(76,187,23,0.3)" : "rgba(76,187,23,0.2)"}, transparent 60%)`,
    WebkitMask:
      "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
    WebkitMaskComposite: "xor",
    maskComposite: "exclude",
  },
};

function DailyDrop({ isAdmin, expanded, onToggle, dropRunning, onDrop }) {
  if (!isAdmin) {
    return null;
  }

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, nextExpanded) => onToggle?.(nextExpanded)}
      sx={{
        bgcolor: "transparent",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        Daily Drop
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            Admin-only: run the Drop Daily process to pull rides from the
            scheduling sheet.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="medium"
            onClick={onDrop}
            disabled={dropRunning}
            startIcon={
              dropRunning ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <RocketLaunchIcon />
              )
            }
          >
            {dropRunning ? "Running…" : "Drop Daily Rides Now"}
          </Button>
          <DropDailyWidget />
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function readStoredDraft() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    logError(new AppError("Failed to parse ride draft", { cause: error }));
    return null;
  }
}

function serializeDraft(single, rows, csvText) {
  if (typeof window === "undefined") return;
  const toStore = {
    single: {
      ...single,
      pickupAt: single.pickupAt ? single.pickupAt.toISOString() : null,
    },
    rows: rows.map((row) => ({
      ...row,
      pickupAt: row.pickupAt ?? null,
    })),
    csvText,
  };
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    logError(new AppError("Unable to persist ride draft", { cause: error }));
  }
}

function clearStoredDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (error) {
    logError(new AppError("Unable to clear ride draft", { cause: error }));
  }
}

function parseDraftSingle(rawSingle) {
  if (!rawSingle) return { ...SINGLE_DEFAULT };
  const pickupAt = rawSingle.pickupAt ? toDayjs(rawSingle.pickupAt) : null;

  // Handle both empty string and numeric values for duration
  const hours = rawSingle.durationHours;
  const minutes = rawSingle.durationMinutes;

  return {
    ...SINGLE_DEFAULT,
    ...rawSingle,
    pickupAt: pickupAt?.isValid?.() ? pickupAt : null,
    durationHours: hours === "" || hours == null ? "" : Number(hours),
    durationMinutes: minutes === "" || minutes == null ? "" : Number(minutes),
  };
}

function parseDraftRows(rawRows) {
  if (!Array.isArray(rawRows)) return [];
  return rawRows.map((row) => ({
    tempId:
      row.tempId ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`),
    tripId: row.tripId || "",
    pickupAt: row.pickupAt || null,
    rideType: row.rideType || "",
    vehicle: row.vehicle || "",
    durationMinutes: Number.isFinite(Number(row.durationMinutes))
      ? Number(row.durationMinutes)
      : DEFAULT_DURATION_MINUTES,
    notes: row.notes || "",
  }));
}

function getDurationMinutes(hours, minutes) {
  // Handle empty strings as 0
  const hoursNum = hours === "" || hours == null ? 0 : Number(hours);
  const minutesNum = minutes === "" || minutes == null ? 0 : Number(minutes);

  const safeHours = Number.isFinite(hoursNum) ? Math.max(0, hoursNum) : 0;
  const safeMinutes = Number.isFinite(minutesNum) ? Math.max(0, minutesNum) : 0;

  return safeHours * 60 + safeMinutes;
}

function ensureLocalPickup(value) {
  if (!value) return null;
  const parsed = toDayjs(value);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.second(0).millisecond(0);
}

/* FIX: avoid double timezone reinterpretation; store UTC instant, display in local/selected TZ */
function rowToPayload(row, currentUser) {
  const tripId = formatTripId(row.tripId || "");
  if (!tripId || !isTripIdValid(tripId)) return null;

  const pickupInput = row.pickupAt;
  const parsed =
    typeof pickupInput?.toDate === "function"
      ? dayjs(pickupInput.toDate())
      : dayjs.isDayjs(pickupInput)
        ? pickupInput
        : dayjs(pickupInput);

  if (!parsed?.isValid?.()) return null;

  const pickupAtUtc = parsed.utc();
  if (!pickupAtUtc?.isValid?.()) return null;
  const timestamp = Timestamp.fromDate(pickupAtUtc.toDate());

  const durationMinutes = Number(row.durationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;

  const rideType = row.rideType?.toString().trim();
  const vehicle = row.vehicle?.toString().trim();
  if (!rideType || !vehicle) return null;

  return {
    tripId,
    pickupTime: timestamp,
    rideDuration: durationMinutes,
    rideType,
    vehicle,
    rideNotes: row.notes ? row.notes.trim() : null,
    claimedBy: null,
    claimedAt: null,
    createdBy: currentUser,
    lastModifiedBy: currentUser,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function downloadCsvTemplate() {
  const csv = getRideTemplateCsv();
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ride-template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function RideEntryForm() {
  const theme = useTheme();
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );

  const initialDraftRef = useRef(null);
  if (initialDraftRef.current === null && typeof window !== "undefined") {
    initialDraftRef.current = readStoredDraft();
  }

  const initialTabRef = useRef(null);
  if (initialTabRef.current === null && typeof window !== "undefined") {
    const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
    initialTabRef.current = stored ? Number(stored) : 0;
  }

  const [activeTab, setActiveTab] = useState(() =>
    Number.isFinite(initialTabRef.current) ? initialTabRef.current : 0,
  );
  const [singleRide, setSingleRide] = useState(() =>
    parseDraftSingle(initialDraftRef.current?.single),
  );
  const [builderRide, setBuilderRide] = useState(() => ({
    ...BUILDER_DEFAULT,
  }));
  const [multiRows, setMultiRows] = useState(() =>
    parseDraftRows(initialDraftRef.current?.rows),
  );
  const [csvText, setCsvText] = useState(
    () => initialDraftRef.current?.csvText || "",
  );
  const [draftRestoredAlert, setDraftRestoredAlert] = useState(() => {
    if (!initialDraftRef.current) return false;
    if (typeof window === "undefined") return true;
    const alerted =
      window.sessionStorage?.getItem?.(DRAFT_ALERT_KEY) === "true";
    if (!alerted) {
      window.sessionStorage?.setItem?.(DRAFT_ALERT_KEY, "true");
      return true;
    }
    return false;
  });

  const [singleErrors, setSingleErrors] = useState({});
  const [showSingleValidation, setShowSingleValidation] = useState(false);
  const [validationPulse, setValidationPulse] = useState(0);

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);
  const [isSubmittingMulti, setIsSubmittingMulti] = useState(false);

  const [pendingRows, setPendingRows] = useState([]);
  const [multiConfirmOpen, setMultiConfirmOpen] = useState(false);
  const [multiSummary, setMultiSummary] = useState({
    total: 0,
    valid: 0,
    invalid: 0,
  });

  const [dropExpanded, setDropExpanded] = useState(false);
  const [dropRunning, setDropRunning] = useState(false);
  const [entryMode, setEntryMode] = useState("single"); // "single" or "multi"
  const [viewMode, setViewMode] = useState("live"); // "live", "queue", or "claimed"

  const { driver } = useDriver();
  const isAdmin = (driver?.access || "").toLowerCase() === "admin";

  const { user } = useAuth();
  const currentUser = user?.email || "unknown";

  const fileInputRef = useRef(null);

  const {
    rows: liveTrips,
    loading: liveLoading,
    error: liveError,
  } = useTripsByState(TRIP_STATES.OPEN);
  const {
    rows: queueTrips,
    loading: queueLoading,
    error: queueError,
  } = useTripsByState(TRIP_STATES.QUEUED);
  const {
    rows: claimedTrips,
    loading: claimedLoading,
    error: claimedError,
  } = useTripsByState(TRIP_STATES.CLAIMED);

  const liveCount = liveLoading ? undefined : liveTrips.length;
  const queueCount = queueLoading ? undefined : queueTrips.length;
  const claimedCount = claimedLoading ? undefined : claimedTrips.length;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(TAB_STORAGE_KEY, String(activeTab));
    } catch (error) {
      logError(new AppError("Unable to persist ride tab", { cause: error }));
    }
  }, [activeTab]);

  useEffect(() => {
    serializeDraft(singleRide, multiRows, csvText);
  }, [singleRide, multiRows, csvText]);

  useEffect(() => {
    if (liveError) {
      logError(liveError, { where: "RideEntryForm", scope: "live-count" });
    }
  }, [liveError]);

  useEffect(() => {
    if (queueError) {
      logError(queueError, { where: "RideEntryForm", scope: "queue-count" });
    }
  }, [queueError]);

  useEffect(() => {
    if (claimedError) {
      logError(claimedError, {
        where: "RideEntryForm",
        scope: "claimed-count",
      });
    }
  }, [claimedError]);

  const tabItems = useMemo(
    () => [{ label: "Ride Entry" }, { label: "View Rides" }],
    [],
  );

  const lazyGridFallback = useMemo(
    () => (
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <CircularProgress size={20} /> Loading…
      </Box>
    ),
    [],
  );

  const singleShakeSx = useCallback(
    (enabled) => {
      if (!enabled) return {};
      const name = `rideShake-${validationPulse}`;
      const base = {
        boxShadow: (themeArg) => `0 0 0 2px ${themeArg.palette.error.main}66`,
      };
      if (prefersReducedMotion) return base;
      return {
        ...base,
        animation: `${name} 0.45s ease`,
        animationFillMode: "both",
        [`@keyframes ${name}`]: {
          "0%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-4px)" },
          "40%": { transform: "translateX(4px)" },
          "60%": { transform: "translateX(-3px)" },
          "80%": { transform: "translateX(3px)" },
          "100%": { transform: "translateX(0)" },
        },
      };
    },
    [prefersReducedMotion, validationPulse],
  );

  const computeSingleErrors = useCallback((ride) => {
    const errors = {};
    if (!ride.tripId?.trim?.()) {
      errors.tripId = "Trip ID is required";
    } else if (!isTripIdValid(ride.tripId)) {
      errors.tripId = "Format: ABCD-12";
    }

    if (!ride.pickupAt || !ride.pickupAt.isValid?.()) {
      errors.pickupAt = "Pickup time required";
    }

    const durationMinutes = getDurationMinutes(
      ride.durationHours,
      ride.durationMinutes,
    );
    if (!durationMinutes || durationMinutes <= 0) {
      errors.duration = "Duration must be greater than 0";
    }

    if (!ride.rideType) {
      errors.rideType = "Ride type required";
    }

    if (!ride.vehicle) {
      errors.vehicle = "Vehicle required";
    }

    return errors;
  }, []);

  const updateSingleRide = useCallback(
    (patch) => {
      setSingleRide((prev) => {
        const next = { ...prev, ...patch };
        if (showSingleValidation) {
          setSingleErrors(computeSingleErrors(next));
        }
        return next;
      });
    },
    [computeSingleErrors, showSingleValidation],
  );

  const handleSingleSubmit = useCallback(async () => {
    if (isSubmittingSingle) return;
    const errors = computeSingleErrors(singleRide);
    setSingleErrors(errors);
    const valid = Object.keys(errors).length === 0;
    if (!valid) {
      setShowSingleValidation(true);
      setValidationPulse((pulse) => pulse + 1);
      setSnackbar({
        open: true,
        message: "Please correct the highlighted fields",
        severity: "error",
      });
      return;
    }

    const totalMinutes = getDurationMinutes(
      singleRide.durationHours,
      singleRide.durationMinutes,
    );
    const pickupAt = ensureLocalPickup(singleRide.pickupAt);
    const payload = rowToPayload(
      {
        tripId: singleRide.tripId,
        pickupAt,
        rideType: singleRide.rideType,
        vehicle: singleRide.vehicle,
        durationMinutes: totalMinutes,
        notes: singleRide.notes,
      },
      currentUser,
    );

    if (!payload) {
      setShowSingleValidation(true);
      setValidationPulse((pulse) => pulse + 1);
      setSnackbar({
        open: true,
        message: "Ride payload invalid. Please review fields.",
        severity: "error",
      });
      return;
    }

    setIsSubmittingSingle(true);
    try {
      await withExponentialBackoff(async () => {
        await addDoc(collection(db, COLLECTIONS.RIDE_QUEUE), payload);
      });
      setSnackbar({
        open: true,
        message: `Ride ${payload.tripId} submitted to queue`,
        severity: "success",
      });
      const reset = { ...SINGLE_DEFAULT };
      setSingleRide(reset);
      setShowSingleValidation(false);
      setSingleErrors({});
      clearStoredDraft();
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError("Failed to submit ride", {
              cause: error,
              context: { where: "RideEntryForm.single" },
            });
      logError(appError);
      setSnackbar({
        open: true,
        message: appError.message || "Ride submission failed",
        severity: "error",
      });
    } finally {
      setIsSubmittingSingle(false);
    }
  }, [computeSingleErrors, currentUser, isSubmittingSingle, singleRide]);

  const handleSingleReset = useCallback(() => {
    setSingleRide({ ...SINGLE_DEFAULT });
    setSingleErrors({});
    setShowSingleValidation(false);
    setValidationPulse((pulse) => pulse + 1);
    setSnackbar({
      open: true,
      message: "Draft cleared",
      severity: "info",
    });
    clearStoredDraft();
  }, []);

  const handleBuilderChange = useCallback((patch) => {
    setBuilderRide((prev) => ({ ...prev, ...patch }));
  }, []);

  const appendBuilderRide = useCallback(() => {
    const durationMinutes = getDurationMinutes(
      builderRide.durationHours,
      builderRide.durationMinutes,
    );
    const pickupAt = ensureLocalPickup(builderRide.pickupAt);
    const candidate = {
      tempId:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      tripId: formatTripId(builderRide.tripId || ""),
      pickupAt: pickupAt?.toISOString?.() ?? null,
      rideType: builderRide.rideType,
      vehicle: builderRide.vehicle,
      durationMinutes: durationMinutes || DEFAULT_DURATION_MINUTES,
      notes: builderRide.notes || "",
    };
    const payload = rowToPayload({ ...candidate, pickupAt }, currentUser);
    if (!payload) {
      setSnackbar({
        open: true,
        message:
          "Builder entry incomplete. Fill required fields before adding.",
        severity: "error",
      });
      setValidationPulse((pulse) => pulse + 1);
      return;
    }
    setMultiRows((prev) => [...prev, candidate]);
    setBuilderRide({ ...BUILDER_DEFAULT });
    setSnackbar({
      open: true,
      message: "Ride added to preview",
      severity: "success",
    });
  }, [builderRide, currentUser]);

  const handleImportCsv = useCallback(
    (file) => {
      if (!file) return;
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: ({ data, meta, errors }) => {
          if (errors?.length) {
            setSnackbar({
              open: true,
              message: errors[0]?.message || "CSV parse error",
              severity: "error",
            });
            return;
          }
          const headers = meta?.fields || [];
          const missing = rideCsvTemplateHeaders.filter(
            (header) => !headers.includes(header),
          );
          if (missing.length) {
            setSnackbar({
              open: true,
              message: `Missing columns: ${missing.join(", ")}`,
              severity: "error",
            });
            return;
          }
          const rows = data
            .map((row) => {
              const pickupValue =
                row.pickupTime ||
                row.pickup_at ||
                row.pickupAt ||
                row.pickup_date;
              const pickupAt = ensureLocalPickup(pickupValue)?.toISOString?.();
              const durationMinutes = Number(
                row.durationMinutes ??
                  row.DurationMinutes ??
                  DEFAULT_DURATION_MINUTES,
              );
              return {
                tempId:
                  typeof crypto !== "undefined" && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random()}`,
                tripId: formatTripId(
                  row.tripId || row.TripID || row.passengerName || "",
                ),
                pickupAt: pickupAt || null,
                rideType:
                  row.rideType ||
                  row.RideType ||
                  builderRide.rideType ||
                  RIDE_TYPES[0] ||
                  "",
                vehicle:
                  row.vehicle ||
                  row.Vehicle ||
                  builderRide.vehicle ||
                  VEHICLES[0] ||
                  "",
                durationMinutes:
                  Number.isFinite(durationMinutes) && durationMinutes > 0
                    ? durationMinutes
                    : DEFAULT_DURATION_MINUTES,
                notes: row.notes || row.RideNotes || "",
              };
            })
            .filter(Boolean);
          if (!rows.length) {
            setSnackbar({
              open: true,
              message: "No valid rows found in CSV",
              severity: "warning",
            });
            return;
          }
          setMultiRows((prev) => [...prev, ...rows]);
          setSnackbar({
            open: true,
            message: `Imported ${rows.length} rides from CSV`,
            severity: "success",
          });
        },
        error: (error) => {
          const appError =
            error instanceof AppError
              ? error
              : new AppError("CSV import failed", {
                  cause: error,
                  context: { where: "RideEntryForm.csv" },
                });
          logError(appError);
          setSnackbar({
            open: true,
            message: appError.message,
            severity: "error",
          });
        },
      });
    },
    [builderRide.rideType, builderRide.vehicle],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click?.();
  }, []);

  const handleFileChange = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (file) {
        handleImportCsv(file);
        event.target.value = "";
      }
    },
    [handleImportCsv],
  );

  const handlePrepareCommit = useCallback(() => {
    if (!multiRows.length) {
      setSnackbar({
        open: true,
        message: "No rides in preview",
        severity: "info",
      });
      return;
    }
    const mapped = multiRows.map((row) => ({
      source: row,
      payload: rowToPayload(row, currentUser),
    }));
    const valid = mapped.filter((entry) => Boolean(entry.payload));
    setPendingRows(valid);
    setMultiSummary({
      total: mapped.length,
      valid: valid.length,
      invalid: mapped.length - valid.length,
    });
    if (!valid.length) {
      setSnackbar({
        open: true,
        message: "All preview rows require attention before committing",
        severity: "error",
      });
      return;
    }
    setMultiConfirmOpen(true);
  }, [currentUser, multiRows]);

  const tripExistsInCollection = useCallback(async (collectionName, tripId) => {
    const q = query(
      collection(db, collectionName),
      where("tripId", "==", tripId),
      limit(1),
    );
    const snap = await safeGet(getDocs(q), {
      where: "RideEntryForm.tripExistsInCollection",
      collectionName,
      tripId,
    });
    return !snap.empty;
  }, []);

  const tripExistsAnywhere = useCallback(
    async (tripId) => {
      const [inQueue, inLive] = await Promise.all([
        tripExistsInCollection(COLLECTIONS.RIDE_QUEUE, tripId),
        tripExistsInCollection(COLLECTIONS.LIVE_RIDES, tripId),
      ]);
      return inQueue || inLive;
    },
    [tripExistsInCollection],
  );

  const handleCommitRows = useCallback(async () => {
    if (!pendingRows.length || isSubmittingMulti) return;
    setIsSubmittingMulti(true);
    try {
      const deduped = [];
      const seen = new Set();
      let duplicates = 0;
      for (const entry of pendingRows) {
        const payload = entry.payload;
        if (!payload) continue;
        if (seen.has(payload.tripId)) {
          duplicates += 1;
          continue;
        }
        if (await tripExistsAnywhere(payload.tripId)) {
          duplicates += 1;
          continue;
        }
        seen.add(payload.tripId);
        deduped.push(payload);
      }

      for (let i = 0; i < deduped.length; i += CHUNK_SIZE) {
        const chunk = deduped.slice(i, i + CHUNK_SIZE);
        if (!chunk.length) continue;
        await withExponentialBackoff(async () => {
          const batch = writeBatch(db);
          chunk.forEach((payload) => {
            const ref = doc(collection(db, COLLECTIONS.RIDE_QUEUE));
            batch.set(ref, payload);
          });
          await batch.commit();
        });
      }

      setSnackbar({
        open: true,
        message: `Committed ${deduped.length} rides${duplicates ? ` (${duplicates} skipped as duplicates)` : ""}`,
        severity: "success",
      });
      setMultiRows([]);
      setCsvText("");
      setPendingRows([]);
      setMultiConfirmOpen(false);
      clearStoredDraft();
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError("Failed to commit rides", {
              cause: error,
              context: { where: "RideEntryForm.multi" },
            });
      logError(appError);
      setSnackbar({
        open: true,
        message: appError.message,
        severity: "error",
      });
    } finally {
      setIsSubmittingMulti(false);
    }
  }, [isSubmittingMulti, pendingRows, tripExistsAnywhere]);

  const handleDropDaily = useCallback(async () => {
    if (dropRunning) return;
    setDropRunning(true);
    try {
      const { ok, stats } = await callDropDailyRidesNow({ dryRun: false });
      if (!ok) {
        throw new AppError("Drop daily rides failed");
      }
      const summary = stats || {};
      setSnackbar({
        open: true,
        message: `Drop complete: imported ${summary.imported ?? 0}, updated ${summary.updatedExisting ?? 0}, duplicates ${summary.duplicatesFound ?? 0}`,
        severity: "success",
      });
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError("Drop daily failed", {
              cause: error,
              context: { where: "RideEntryForm.dropDaily" },
            });
      logError(appError);
      setSnackbar({
        open: true,
        message: appError.message,
        severity: "error",
      });
    } finally {
      setDropRunning(false);
    }
  }, [dropRunning]);

  const handleSnackbarClose = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  const renderSingleRide = () => {
    const pickupAtFormatted = singleRide.pickupAt?.isValid?.()
      ? singleRide.pickupAt
      : null;
    const totalMinutes = getDurationMinutes(
      singleRide.durationHours,
      singleRide.durationMinutes,
    );
    const provisionalEnd = pickupAtFormatted
      ? pickupAtFormatted.add(totalMinutes || 0, "minute")
      : null;
    const safeDuration =
      pickupAtFormatted && provisionalEnd
        ? durationSafe(pickupAtFormatted, provisionalEnd)
        : 0;
    const endDisplay =
      safeDuration > 0 && provisionalEnd?.isValid?.()
        ? formatDateTime(provisionalEnd)
        : "N/A";

    const isFormValid =
      Object.keys(computeSingleErrors(singleRide)).length === 0;

    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          gap: 2.5,
        }}
      >
        {/* Form Section */}
        <Paper
          elevation={0}
          sx={{ ...MODERN_CARD_SX, flex: 1, p: { xs: 2, sm: 3 } }}
        >
          <Stack spacing={2.5}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  backgroundColor: (t) => `${t.palette.primary.main}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "primary.main",
                }}
              >
                <RocketLaunchIcon />
              </Box>
              <Typography
                variant="h5"
                fontWeight={800}
                sx={{ color: "text.primary" }}
              >
                Single Ride Entry
              </Typography>
            </Box>

            <Grid container spacing={GRID_SPACING}>
              <Grid item xs={12}>
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Trip Details
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Trip ID"
                  value={singleRide.tripId}
                  onChange={(event) =>
                    updateSingleRide({
                      tripId: formatTripId(event.target.value),
                    })
                  }
                  onBlur={() => {
                    const formatted = formatTripId(singleRide.tripId);
                    updateSingleRide({ tripId: formatted });
                  }}
                  error={Boolean(singleErrors.tripId) && showSingleValidation}
                  helperText={
                    showSingleValidation && singleErrors.tripId
                      ? singleErrors.tripId
                      : "Format XXXX-XX"
                  }
                  inputProps={{ maxLength: 7, "aria-label": "Trip ID" }}
                  size="small"
                  fullWidth
                  sx={singleShakeSx(
                    showSingleValidation && Boolean(singleErrors.tripId),
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <DateTimePicker
                  label="Pickup Time"
                  value={singleRide.pickupAt}
                  onChange={(value) => updateSingleRide({ pickupAt: value })}
                  minutesStep={5}
                  slotProps={{
                    textField: {
                      size: "small",
                      fullWidth: true,
                      error:
                        Boolean(singleErrors.pickupAt) && showSingleValidation,
                      helperText:
                        showSingleValidation && singleErrors.pickupAt
                          ? singleErrors.pickupAt
                          : "",
                      sx: singleShakeSx(
                        showSingleValidation && Boolean(singleErrors.pickupAt),
                      ),
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <Stack direction="row" spacing={1.5}>
                  <TextField
                    label="Hours"
                    type="number"
                    value={singleRide.durationHours}
                    onChange={(event) => {
                      const val = event.target.value;
                      updateSingleRide({
                        durationHours:
                          val === "" ? "" : Math.max(0, Number(val)),
                      });
                    }}
                    error={
                      Boolean(singleErrors.duration) && showSingleValidation
                    }
                    helperText={
                      showSingleValidation && singleErrors.duration
                        ? singleErrors.duration
                        : ""
                    }
                    size="small"
                    fullWidth
                    inputProps={{ min: 0, "aria-label": "Duration hours" }}
                    sx={singleShakeSx(
                      showSingleValidation && Boolean(singleErrors.duration),
                    )}
                  />
                  <TextField
                    label="Minutes"
                    type="number"
                    value={singleRide.durationMinutes}
                    onChange={(event) => {
                      const val = event.target.value;
                      updateSingleRide({
                        durationMinutes:
                          val === "" ? "" : Math.max(0, Number(val)),
                      });
                    }}
                    error={
                      Boolean(singleErrors.duration) && showSingleValidation
                    }
                    helperText={
                      showSingleValidation && singleErrors.duration
                        ? singleErrors.duration
                        : ""
                    }
                    size="small"
                    fullWidth
                    inputProps={{
                      min: 0,
                      max: 59,
                      "aria-label": "Duration minutes",
                    }}
                    sx={singleShakeSx(
                      showSingleValidation && Boolean(singleErrors.duration),
                    )}
                  />
                </Stack>
              </Grid>

              <Grid item xs={12}>
                <Stack direction="row" spacing={1.5}>
                  <Box sx={{ flex: 1 }}>
                    <LrpSelectField
                      label="Ride Type"
                      name="rideType"
                      value={singleRide.rideType ?? ""}
                      onChange={(event) =>
                        updateSingleRide({ rideType: event.target.value })
                      }
                      placeholder="Choose type…"
                      options={RIDE_TYPES.map((type) => ({
                        value: type,
                        label: type,
                      }))}
                      helperText={
                        showSingleValidation && singleErrors.rideType
                          ? singleErrors.rideType
                          : ""
                      }
                      size="small"
                      FormControlProps={{
                        error:
                          Boolean(singleErrors.rideType) &&
                          showSingleValidation,
                        sx: singleShakeSx(
                          showSingleValidation &&
                            Boolean(singleErrors.rideType),
                        ),
                      }}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <LrpSelectField
                      label="Vehicle"
                      name="vehicle"
                      value={singleRide.vehicle ?? ""}
                      onChange={(event) =>
                        updateSingleRide({ vehicle: event.target.value })
                      }
                      placeholder="Choose vehicle…"
                      options={VEHICLES.map((vehicle) => ({
                        value: vehicle.id || vehicle.name || vehicle,
                        label: vehicle.name || vehicle.label || String(vehicle),
                      }))}
                      helperText={
                        showSingleValidation && singleErrors.vehicle
                          ? singleErrors.vehicle
                          : ""
                      }
                      size="small"
                      FormControlProps={{
                        error:
                          Boolean(singleErrors.vehicle) && showSingleValidation,
                        sx: singleShakeSx(
                          showSingleValidation && Boolean(singleErrors.vehicle),
                        ),
                      }}
                    />
                  </Box>
                </Stack>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Ride Notes"
                  value={singleRide.notes}
                  onChange={(event) =>
                    updateSingleRide({ notes: event.target.value })
                  }
                  multiline
                  minRows={2}
                  size="small"
                  fullWidth
                />
              </Grid>

              <Grid item xs={12}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: (t) => `1px solid ${t.palette.divider}`,
                    bgcolor: (t) =>
                      t.palette.mode === "dark"
                        ? "rgba(76,187,23,0.05)"
                        : "rgba(76,187,23,0.03)",
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{ color: "primary.main" }}
                    >
                      Estimated End:
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {endDisplay}
                    </Typography>
                  </Stack>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Actions
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={handleSingleReset}
                    disabled={isSubmittingSingle}
                    fullWidth
                    size="large"
                    sx={{
                      borderRadius: 3,
                      py: 1.5,
                      fontWeight: 700,
                      textTransform: "none",
                    }}
                  >
                    Reset Form
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSingleSubmit}
                    disabled={isSubmittingSingle}
                    fullWidth
                    size="large"
                    startIcon={
                      isSubmittingSingle ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : (
                        <RocketLaunchIcon />
                      )
                    }
                    sx={{
                      borderRadius: 3,
                      py: 1.5,
                      fontWeight: 700,
                      textTransform: "none",
                      boxShadow: "0 4px 14px rgba(76,187,23,0.35)",
                      "&:hover": {
                        boxShadow: "0 6px 20px rgba(76,187,23,0.45)",
                      },
                    }}
                  >
                    {isSubmittingSingle ? "Submitting…" : "Submit to Queue"}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        </Paper>

        {/* Live Preview Section */}
        <Box
          sx={{
            flex: { lg: 0.65 },
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <Typography variant="h6" fontWeight={700} sx={{ px: 1 }}>
            Live Preview
          </Typography>
          <Paper
            elevation={0}
            sx={{
              ...MODERN_CARD_SX,
              p: 3,
              border: isFormValid ? "2px solid" : "2px dashed",
              borderColor: isFormValid ? "primary.main" : "divider",
              opacity: isFormValid ? 1 : 0.6,
              transition: "all 0.3s ease",
            }}
          >
            <Stack spacing={2.5}>
              {/* Vehicle Header */}
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    backgroundColor: (t) => `${t.palette.primary.main}16`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "primary.main",
                  }}
                >
                  <DirectionsCar fontSize="large" />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="overline"
                    sx={{ color: "text.secondary", letterSpacing: 1.2 }}
                  >
                    {singleRide.rideType || "Ride Type"}
                  </Typography>
                  <Typography variant="h6" fontWeight={800}>
                    {singleRide.vehicle || "Vehicle"}
                  </Typography>
                </Box>
              </Stack>

              {/* Trip ID */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: (t) =>
                    t.palette.mode === "dark"
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(0,0,0,0.02)",
                  border: (t) => `1px solid ${t.palette.divider}`,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", fontWeight: 600 }}
                >
                  TRIP ID
                </Typography>
                <Typography
                  variant="h5"
                  fontWeight={900}
                  sx={{ color: "primary.main", mt: 0.5 }}
                >
                  {singleRide.tripId || "XXXX-XX"}
                </Typography>
              </Box>

              {/* Pickup Time */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: (t) => `${t.palette.primary.main}12`,
                  border: (t) => `1px solid ${t.palette.primary.main}40`,
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <ScheduleRoundedIcon sx={{ color: "primary.main" }} />
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary", fontWeight: 600 }}
                    >
                      PICKUP TIME
                    </Typography>
                    <Typography
                      variant="body1"
                      fontWeight={700}
                      sx={{ color: "primary.main" }}
                    >
                      {pickupAtFormatted
                        ? formatDateTime(pickupAtFormatted)
                        : "Not set"}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              {/* Duration & End Time */}
              <Stack direction="row" spacing={1.5}>
                <Chip
                  icon={<AccessTimeIcon />}
                  label={totalMinutes > 0 ? `${totalMinutes} min` : "Duration"}
                  sx={{
                    flex: 1,
                    height: 44,
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    bgcolor: (t) =>
                      t.palette.mode === "dark"
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.04)",
                    "& .MuiChip-icon": { color: "primary.main" },
                  }}
                />
                <Box
                  sx={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: (t) =>
                      t.palette.mode === "dark"
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.04)",
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    sx={{ color: "text.secondary", mr: 1 }}
                  >
                    Ends:
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {safeDuration > 0 && provisionalEnd?.isValid?.()
                      ? provisionalEnd.format("h:mm A")
                      : "—"}
                  </Typography>
                </Box>
              </Stack>

              {/* Notes */}
              {singleRide.notes && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: (t) =>
                      t.palette.mode === "dark"
                        ? "rgba(255,255,255,0.03)"
                        : "rgba(0,0,0,0.02)",
                    border: (t) => `1px solid ${t.palette.divider}`,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: 600 }}
                  >
                    NOTES
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}
                  >
                    {singleRide.notes}
                  </Typography>
                </Box>
              )}

              {/* Validation Status */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: isFormValid
                    ? (t) =>
                        t.palette.mode === "dark"
                          ? "rgba(76,187,23,0.15)"
                          : "rgba(76,187,23,0.08)"
                    : (t) =>
                        t.palette.mode === "dark"
                          ? "rgba(255,152,0,0.15)"
                          : "rgba(255,152,0,0.08)",
                  border: (t) =>
                    `1px solid ${isFormValid ? t.palette.success.main : t.palette.warning.main}`,
                }}
              >
                <Typography
                  variant="body2"
                  fontWeight={600}
                  sx={{ color: isFormValid ? "success.main" : "warning.main" }}
                >
                  {isFormValid
                    ? "✓ Ready to submit"
                    : "⚠ Fill required fields"}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Box>
      </Box>
    );
  };

  const renderBuilder = () => {
    return (
      <>
        <Paper elevation={0} sx={{ ...MODERN_CARD_SX, p: { xs: 2, sm: 3 } }}>
          <Grid container spacing={GRID_SPACING}>
            <Grid item xs={12}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "center" }}
              >
                <Typography variant="h6" fontWeight={700}>
                  Multi-Ride Builder
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <input
                    hidden
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<UploadFileIcon />}
                    onClick={openFilePicker}
                  >
                    Import CSV
                  </Button>
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={downloadCsvTemplate}
                  >
                    CSV Template
                  </Button>
                </Stack>
              </Stack>
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Paste CSV"
                value={csvText}
                onChange={(event) => setCsvText(event.target.value)}
                multiline
                minRows={3}
                size="small"
                fullWidth
                placeholder="Optional: paste CSV rows here and import via button"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Trip ID"
                value={builderRide.tripId}
                onChange={(event) =>
                  handleBuilderChange({
                    tripId: formatTripId(event.target.value),
                  })
                }
                size="small"
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <DateTimePicker
                label="Pickup Time"
                value={builderRide.pickupAt}
                onChange={(value) => handleBuilderChange({ pickupAt: value })}
                minutesStep={5}
                slotProps={{ textField: { size: "small", fullWidth: true } }}
              />
            </Grid>

            <Grid item xs={12}>
              <Stack direction="row" spacing={1.5}>
                <TextField
                  label="Hours"
                  type="number"
                  value={builderRide.durationHours}
                  onChange={(event) => {
                    const val = event.target.value;
                    handleBuilderChange({
                      durationHours: val === "" ? "" : Math.max(0, Number(val)),
                    });
                  }}
                  size="small"
                  fullWidth
                  inputProps={{ min: 0 }}
                />
                <TextField
                  label="Minutes"
                  type="number"
                  value={builderRide.durationMinutes}
                  onChange={(event) => {
                    const val = event.target.value;
                    handleBuilderChange({
                      durationMinutes:
                        val === "" ? "" : Math.max(0, Number(val)),
                    });
                  }}
                  size="small"
                  fullWidth
                  inputProps={{ min: 0, max: 59 }}
                />
              </Stack>
            </Grid>

            <Grid item xs={12}>
              <Stack direction="row" spacing={1.5}>
                <Box sx={{ flex: 1 }}>
                  <LrpSelectField
                    label="Ride Type"
                    name="builderRideType"
                    value={builderRide.rideType ?? ""}
                    onChange={(event) =>
                      handleBuilderChange({ rideType: event.target.value })
                    }
                    placeholder="Choose type…"
                    options={RIDE_TYPES.map((type) => ({
                      value: type,
                      label: type,
                    }))}
                    size="small"
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <LrpSelectField
                    label="Vehicle"
                    name="builderVehicle"
                    value={builderRide.vehicle ?? ""}
                    onChange={(event) =>
                      handleBuilderChange({ vehicle: event.target.value })
                    }
                    placeholder="Choose vehicle…"
                    options={VEHICLES.map((vehicle) => ({
                      value: vehicle.id || vehicle.name || vehicle,
                      label: vehicle.name || vehicle.label || String(vehicle),
                    }))}
                    size="small"
                  />
                </Box>
              </Stack>
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Notes"
                value={builderRide.notes}
                onChange={(event) =>
                  handleBuilderChange({ notes: event.target.value })
                }
                multiline
                minRows={2}
                size="small"
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  variant="outlined"
                  color="primary"
                  size="large"
                  onClick={() => {
                    if (!csvText.trim()) {
                      setSnackbar({
                        open: true,
                        message: "Paste CSV content first",
                        severity: "info",
                      });
                      return;
                    }
                    const csvBlob = new Blob([csvText], { type: "text/csv" });
                    handleImportCsv(csvBlob);
                  }}
                  startIcon={<UploadFileIcon />}
                  fullWidth
                  sx={{
                    borderRadius: 3,
                    py: 1.5,
                    fontWeight: 700,
                    textTransform: "none",
                  }}
                >
                  Import Pasted CSV
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={appendBuilderRide}
                  fullWidth
                  sx={{
                    borderRadius: 3,
                    py: 1.5,
                    fontWeight: 700,
                    textTransform: "none",
                    boxShadow: "0 4px 14px rgba(76,187,23,0.35)",
                    "&:hover": {
                      boxShadow: "0 6px 20px rgba(76,187,23,0.45)",
                    },
                  }}
                >
                  Add to Preview
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {multiRows.length > 0 && (
          <Paper
            elevation={0}
            sx={{ ...MODERN_CARD_SX, p: { xs: 2, sm: 3 }, mt: 3 }}
          >
            <Stack spacing={3}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography variant="h6" fontWeight={800}>
                  Preview Queue
                </Typography>
                <Chip
                  label={`${multiRows.length} ${multiRows.length === 1 ? "ride" : "rides"}`}
                  color="primary"
                  sx={{ fontWeight: 700, fontSize: "0.9rem" }}
                />
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(auto-fill, minmax(340px, 1fr))",
                  },
                  gap: 2,
                  maxHeight: 600,
                  overflowY: "auto",
                  pr: 1,
                }}
              >
                {multiRows.map((row) => {
                  const pickupDate = row.pickupAt
                    ? toDayjs(row.pickupAt)
                    : null;
                  const isValid = Boolean(
                    row.tripId &&
                      isTripIdValid(row.tripId) &&
                      pickupDate?.isValid?.() &&
                      row.rideType &&
                      row.vehicle &&
                      row.durationMinutes > 0,
                  );

                  return (
                    <Paper
                      key={row.tempId}
                      elevation={0}
                      sx={{
                        p: 2.5,
                        borderRadius: 3,
                        border: "2px solid",
                        borderColor: isValid ? "primary.main" : "warning.main",
                        bgcolor: (t) =>
                          isValid
                            ? t.palette.mode === "dark"
                              ? "rgba(76,187,23,0.08)"
                              : "rgba(76,187,23,0.04)"
                            : t.palette.mode === "dark"
                              ? "rgba(255,152,0,0.08)"
                              : "rgba(255,152,0,0.04)",
                        transition: "all 0.2s ease",
                        "&:hover": {
                          transform: "translateY(-2px)",
                          boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
                        },
                      }}
                    >
                      <Stack spacing={2}>
                        {/* Header */}
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                        >
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              backgroundColor: (t) =>
                                `${t.palette.primary.main}20`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "primary.main",
                            }}
                          >
                            <DirectionsCar fontSize="small" />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              variant="caption"
                              sx={{ color: "text.secondary" }}
                            >
                              {row.rideType || "Type"}
                            </Typography>
                            <Typography
                              variant="subtitle2"
                              fontWeight={700}
                              sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.vehicle || "Vehicle"}
                            </Typography>
                          </Box>
                          <Tooltip title="Remove from queue">
                            <Button
                              size="small"
                              color="error"
                              onClick={() =>
                                setMultiRows((prev) =>
                                  prev.filter((r) => r.tempId !== row.tempId),
                                )
                              }
                              sx={{ minWidth: "auto", p: 0.5 }}
                            >
                              ✕
                            </Button>
                          </Tooltip>
                        </Stack>

                        {/* Trip ID */}
                        <Box
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: (t) =>
                              t.palette.mode === "dark"
                                ? "rgba(255,255,255,0.05)"
                                : "rgba(0,0,0,0.03)",
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary", fontWeight: 600 }}
                          >
                            TRIP ID
                          </Typography>
                          <Typography
                            variant="body1"
                            fontWeight={800}
                            sx={{ color: "primary.main" }}
                          >
                            {row.tripId || "N/A"}
                          </Typography>
                        </Box>

                        {/* Time & Duration */}
                        <Stack spacing={1}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <ScheduleRoundedIcon
                              sx={{ fontSize: 18, color: "primary.main" }}
                            />
                            <Typography variant="body2" fontWeight={600}>
                              {pickupDate?.isValid?.()
                                ? formatDateTime(pickupDate)
                                : "No pickup time"}
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <AccessTimeIcon
                              sx={{ fontSize: 18, color: "text.secondary" }}
                            />
                            <Typography
                              variant="body2"
                              sx={{ color: "text.secondary" }}
                            >
                              {row.durationMinutes > 0
                                ? `${row.durationMinutes} min`
                                : "No duration"}
                            </Typography>
                          </Box>
                        </Stack>

                        {/* Notes */}
                        {row.notes && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              fontStyle: "italic",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {row.notes}
                          </Typography>
                        )}

                        {/* Status Badge */}
                        <Chip
                          label={isValid ? "Ready" : "Incomplete"}
                          size="small"
                          color={isValid ? "success" : "warning"}
                          sx={{ fontWeight: 600, alignSelf: "flex-start" }}
                        />
                      </Stack>
                    </Paper>
                  );
                })}
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  variant="outlined"
                  color="primary"
                  size="large"
                  onClick={() => setMultiRows([])}
                  disabled={isSubmittingMulti}
                  fullWidth
                  sx={{
                    borderRadius: 3,
                    py: 1.5,
                    fontWeight: 700,
                    textTransform: "none",
                  }}
                >
                  Clear Preview
                </Button>
                <Tooltip title="Validates and shows summary before committing">
                  <span style={{ flex: 1 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      size="large"
                      onClick={handlePrepareCommit}
                      disabled={isSubmittingMulti}
                      fullWidth
                      startIcon={
                        isSubmittingMulti ? (
                          <CircularProgress size={18} color="inherit" />
                        ) : (
                          <RocketLaunchIcon />
                        )
                      }
                      sx={{
                        borderRadius: 3,
                        py: 1.5,
                        fontWeight: 700,
                        textTransform: "none",
                        boxShadow: "0 4px 14px rgba(76,187,23,0.35)",
                        "&:hover": {
                          boxShadow: "0 6px 20px rgba(76,187,23,0.45)",
                        },
                      }}
                    >
                      {isSubmittingMulti
                        ? "Committing…"
                        : `Commit ${multiRows.length} ${multiRows.length === 1 ? "Ride" : "Rides"}`}
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
          </Paper>
        )}
      </>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 0:
        return (
          <Stack spacing={3}>
            {/* Mode Toggle */}
            <Paper elevation={0} sx={{ ...MODERN_CARD_SX, p: 2 }}>
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                justifyContent="center"
              >
                <Button
                  variant={entryMode === "single" ? "contained" : "outlined"}
                  color="primary"
                  onClick={() => setEntryMode("single")}
                  size="large"
                  sx={{
                    flex: 1,
                    maxWidth: 240,
                    py: 1.5,
                    borderRadius: 3,
                    fontWeight: 700,
                    textTransform: "none",
                    fontSize: "1rem",
                  }}
                >
                  Single Ride
                </Button>
                <Button
                  variant={entryMode === "multi" ? "contained" : "outlined"}
                  color="primary"
                  onClick={() => setEntryMode("multi")}
                  size="large"
                  sx={{
                    flex: 1,
                    maxWidth: 240,
                    py: 1.5,
                    borderRadius: 3,
                    fontWeight: 700,
                    textTransform: "none",
                    fontSize: "1rem",
                  }}
                >
                  Multi-Ride Builder
                </Button>
              </Stack>
            </Paper>

            {/* Render form based on mode */}
            {entryMode === "single" ? renderSingleRide() : renderBuilder()}
          </Stack>
        );
      case 1:
        return (
          <Stack spacing={3}>
            {/* View Mode Toggle */}
            <Paper elevation={0} sx={{ ...MODERN_CARD_SX, p: 2 }}>
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                justifyContent="center"
                flexWrap="wrap"
              >
                <Button
                  variant={viewMode === "live" ? "contained" : "outlined"}
                  color="primary"
                  onClick={() => setViewMode("live")}
                  size="large"
                  sx={{
                    flex: { xs: 1, sm: "0 1 180px" },
                    py: 1.5,
                    borderRadius: 3,
                    fontWeight: 700,
                    textTransform: "none",
                    fontSize: "1rem",
                  }}
                  endIcon={
                    liveCount !== undefined && (
                      <Chip
                        label={liveCount}
                        size="small"
                        sx={{
                          height: 24,
                          fontWeight: 700,
                          bgcolor:
                            viewMode === "live"
                              ? "rgba(255,255,255,0.2)"
                              : "primary.main",
                          color:
                            viewMode === "live"
                              ? "white"
                              : "primary.contrastText",
                        }}
                      />
                    )
                  }
                >
                  Live
                </Button>
                <Button
                  variant={viewMode === "queue" ? "contained" : "outlined"}
                  color="primary"
                  onClick={() => setViewMode("queue")}
                  size="large"
                  sx={{
                    flex: { xs: 1, sm: "0 1 180px" },
                    py: 1.5,
                    borderRadius: 3,
                    fontWeight: 700,
                    textTransform: "none",
                    fontSize: "1rem",
                  }}
                  endIcon={
                    queueCount !== undefined && (
                      <Chip
                        label={queueCount}
                        size="small"
                        sx={{
                          height: 24,
                          fontWeight: 700,
                          bgcolor:
                            viewMode === "queue"
                              ? "rgba(255,255,255,0.2)"
                              : "primary.main",
                          color:
                            viewMode === "queue"
                              ? "white"
                              : "primary.contrastText",
                        }}
                      />
                    )
                  }
                >
                  Queue
                </Button>
                <Button
                  variant={viewMode === "claimed" ? "contained" : "outlined"}
                  color="primary"
                  onClick={() => setViewMode("claimed")}
                  size="large"
                  sx={{
                    flex: { xs: 1, sm: "0 1 180px" },
                    py: 1.5,
                    borderRadius: 3,
                    fontWeight: 700,
                    textTransform: "none",
                    fontSize: "1rem",
                  }}
                  endIcon={
                    claimedCount !== undefined && (
                      <Chip
                        label={claimedCount}
                        size="small"
                        sx={{
                          height: 24,
                          fontWeight: 700,
                          bgcolor:
                            viewMode === "claimed"
                              ? "rgba(255,255,255,0.2)"
                              : "primary.main",
                          color:
                            viewMode === "claimed"
                              ? "white"
                              : "primary.contrastText",
                        }}
                      />
                    )
                  }
                >
                  Claimed
                </Button>
              </Stack>
            </Paper>

            {/* Render grid based on view mode */}
            <Paper elevation={2} sx={SECTION_PAPER_SX}>
              <Suspense fallback={lazyGridFallback}>
                {viewMode === "live" && <LiveRidesGrid />}
                {viewMode === "queue" && <RideQueueGrid />}
                {viewMode === "claimed" && <ClaimedRidesGrid />}
              </Suspense>
            </Paper>
          </Stack>
        );
      default:
        return null;
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ResponsiveContainer maxWidth={1240}>
        <Stack spacing={{ xs: 2, md: 2.5 }}>
          <Paper elevation={2} sx={SECTION_PAPER_SX}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              🚐 Ride Entry
            </Typography>
            <Tabs
              value={activeTab}
              onChange={(_, value) => setActiveTab(value)}
              variant="scrollable"
              scrollButtons
              allowScrollButtonsMobile
              TabIndicatorProps={{
                sx: { backgroundColor: theme.palette.primary.main },
              }}
              sx={{
                "& .MuiTab-root": {
                  minWidth: { xs: "auto", sm: 140 },
                  fontWeight: 600,
                  py: 1.5,
                },
              }}
            >
              {tabItems.map((tab, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <Tab key={index} label={tab.label} />
              ))}
            </Tabs>
          </Paper>

          {draftRestoredAlert && (
            <Alert
              severity="info"
              onClose={() => setDraftRestoredAlert(false)}
              sx={{ borderRadius: 2, py: 0.5 }}
            >
              Draft restored from last session.
            </Alert>
          )}

          {renderTabContent()}

          {isAdmin && (
            <Box sx={{ mt: 1 }}>
              <DailyDrop
                isAdmin={isAdmin}
                expanded={dropExpanded}
                onToggle={setDropExpanded}
                dropRunning={dropRunning}
                onDrop={handleDropDaily}
              />
            </Box>
          )}
        </Stack>
      </ResponsiveContainer>

      <Dialog
        open={multiConfirmOpen}
        onClose={() => setMultiConfirmOpen(false)}
      >
        <DialogTitle>Commit Rides</DialogTitle>
        <DialogContent dividers>
          <Typography gutterBottom>Total rows: {multiSummary.total}</Typography>
          <Typography gutterBottom>Valid rows: {multiSummary.valid}</Typography>
          <Typography gutterBottom>
            Needs attention: {multiSummary.invalid}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            We validate Trip ID, pickup time, ride type, vehicle, and positive
            duration before writing.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMultiConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCommitRows}
            disabled={isSubmittingMulti}
            startIcon={
              isSubmittingMulti ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <RocketLaunchIcon />
              )
            }
          >
            {isSubmittingMulti
              ? "Committing…"
              : `Commit ${multiSummary.valid} rides`}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </LocalizationProvider>
  );
}
