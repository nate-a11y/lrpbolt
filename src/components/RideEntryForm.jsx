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
import { LocalizationProvider, DateTimePicker } from "@mui/x-date-pickers-pro";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DataGridPro, GridToolbar } from "@mui/x-data-grid-pro";
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

function TabLabel({ label, count }) {
  if (typeof count === "number") {
    return (
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
        <span>{label}</span>
        <Chip
          size="small"
          label={count ?? 0}
          color="primary"
          sx={{ fontWeight: 600 }}
        />
      </Box>
    );
  }
  return <>{label}</>;
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
    () => [
      { label: "Single Ride" },
      { label: "Multi-Ride Builder" },
      { label: <TabLabel label="Live" count={liveCount} /> },
      { label: <TabLabel label="Queue" count={queueCount} /> },
      { label: <TabLabel label="Claimed" count={claimedCount} /> },
    ],
    [claimedCount, liveCount, queueCount],
  );

  const lazyGridFallback = useMemo(
    () => (
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <CircularProgress size={20} /> Loading…
      </Box>
    ),
    [],
  );

  const builderColumns = useMemo(
    () => [
      {
        field: "tripId",
        headerName: "Trip ID",
        minWidth: 140,
        flex: 1,
        editable: true,
        valueFormatter: ({ value }) => (value ? value : "N/A"),
      },
      {
        field: "pickupAt",
        headerName: "Pickup Time",
        minWidth: 200,
        flex: 1.1,
        editable: true,
        valueFormatter: ({ value }) => (value ? formatDateTime(value) : "N/A"),
      },
      {
        field: "rideType",
        headerName: "Ride Type",
        minWidth: 140,
        flex: 1,
        editable: true,
        valueFormatter: ({ value }) => (value ? value : "N/A"),
      },
      {
        field: "vehicle",
        headerName: "Vehicle",
        minWidth: 140,
        flex: 1,
        editable: true,
        valueFormatter: ({ value }) => (value ? value : "N/A"),
      },
      {
        field: "durationMinutes",
        headerName: "Duration (min)",
        type: "number",
        minWidth: 140,
        flex: 0.8,
        editable: true,
        valueFormatter: ({ value }) =>
          Number.isFinite(Number(value)) && Number(value) > 0 ? value : "N/A",
      },
      {
        field: "notes",
        headerName: "Notes",
        minWidth: 220,
        flex: 1.2,
        editable: true,
        valueFormatter: ({ value }) => (value ? value : "N/A"),
      },
    ],
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

  const handleProcessRowUpdate = useCallback((newRow) => {
    setMultiRows((prev) =>
      prev.map((row) => (row.tempId === newRow.tempId ? newRow : row)),
    );
    return newRow;
  }, []);

  const handleProcessRowError = useCallback((error) => {
    const appError =
      error instanceof AppError
        ? error
        : new AppError("Failed to update row", {
            cause: error,
            context: { where: "RideEntryForm.preview" },
          });
    logError(appError);
    setSnackbar({
      open: true,
      message: appError.message,
      severity: "error",
    });
  }, []);

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

    return (
      <Paper elevation={2} sx={SECTION_PAPER_SX}>
        <Grid container spacing={GRID_SPACING}>
          <Grid item xs={12}>
            <Typography variant="h6" fontWeight={700}>
              Single Ride
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Trip ID"
              value={singleRide.tripId}
              onChange={(event) =>
                updateSingleRide({ tripId: formatTripId(event.target.value) })
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

          <Grid item xs={12} sm={6}>
            <DateTimePicker
              label="Pickup Time"
              value={singleRide.pickupAt}
              onChange={(value) => updateSingleRide({ pickupAt: value })}
              minutesStep={5}
              slotProps={{
                textField: {
                  size: "small",
                  fullWidth: true,
                  error: Boolean(singleErrors.pickupAt) && showSingleValidation,
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

          <Grid item xs={6}>
            <TextField
              label="Hours"
              type="number"
              value={singleRide.durationHours}
              onChange={(event) => {
                const val = event.target.value;
                updateSingleRide({
                  durationHours: val === "" ? "" : Math.max(0, Number(val)),
                });
              }}
              error={Boolean(singleErrors.duration) && showSingleValidation}
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
          </Grid>

          <Grid item xs={6}>
            <TextField
              label="Minutes"
              type="number"
              value={singleRide.durationMinutes}
              onChange={(event) => {
                const val = event.target.value;
                updateSingleRide({
                  durationMinutes: val === "" ? "" : Math.max(0, Number(val)),
                });
              }}
              error={Boolean(singleErrors.duration) && showSingleValidation}
              helperText={
                showSingleValidation && singleErrors.duration
                  ? singleErrors.duration
                  : ""
              }
              size="small"
              fullWidth
              inputProps={{ min: 0, max: 59, "aria-label": "Duration minutes" }}
              sx={singleShakeSx(
                showSingleValidation && Boolean(singleErrors.duration),
              )}
            />
          </Grid>

          <Grid item xs={6}>
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
                error: Boolean(singleErrors.rideType) && showSingleValidation,
                sx: singleShakeSx(
                  showSingleValidation && Boolean(singleErrors.rideType),
                ),
              }}
            />
          </Grid>

          <Grid item xs={6}>
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
                error: Boolean(singleErrors.vehicle) && showSingleValidation,
                sx: singleShakeSx(
                  showSingleValidation && Boolean(singleErrors.vehicle),
                ),
              }}
            />
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
            <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
              Estimated end: {endDisplay}
            </Alert>
          </Grid>

          <Grid item xs={12}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleSingleReset}
                disabled={isSubmittingSingle}
                fullWidth
                size="medium"
              >
                Reset
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSingleSubmit}
                disabled={isSubmittingSingle}
                fullWidth
                size="medium"
                startIcon={
                  isSubmittingSingle ? (
                    <CircularProgress size={18} />
                  ) : (
                    <RocketLaunchIcon />
                  )
                }
              >
                {isSubmittingSingle ? "Submitting…" : "Submit"}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>
    );
  };

  const renderBuilder = () => {
    return (
      <>
        <Paper elevation={2} sx={SECTION_PAPER_SX}>
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

            <Grid item xs={12} sm={6}>
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
            <Grid item xs={12} sm={6}>
              <DateTimePicker
                label="Pickup Time"
                value={builderRide.pickupAt}
                onChange={(value) => handleBuilderChange({ pickupAt: value })}
                minutesStep={5}
                slotProps={{ textField: { size: "small", fullWidth: true } }}
              />
            </Grid>

            <Grid item xs={6}>
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
            </Grid>

            <Grid item xs={6}>
              <TextField
                label="Minutes"
                type="number"
                value={builderRide.durationMinutes}
                onChange={(event) => {
                  const val = event.target.value;
                  handleBuilderChange({
                    durationMinutes: val === "" ? "" : Math.max(0, Number(val)),
                  });
                }}
                size="small"
                fullWidth
                inputProps={{ min: 0, max: 59 }}
              />
            </Grid>

            <Grid item xs={6}>
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
            </Grid>

            <Grid item xs={6}>
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
                  size="medium"
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
                >
                  Import Pasted CSV
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  size="medium"
                  startIcon={<AddIcon />}
                  onClick={appendBuilderRide}
                  fullWidth
                >
                  Add to Preview
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {multiRows.length > 0 && (
          <Paper elevation={2} sx={SECTION_PAPER_SX}>
            <Stack spacing={2}>
              <Typography variant="subtitle1" fontWeight={700}>
                Preview ({multiRows.length})
              </Typography>
              <Box sx={{ height: 360, width: "100%" }}>
                <DataGridPro
                  id="ridebuilder-grid"
                  rows={multiRows}
                  columns={builderColumns}
                  getRowId={(row) => row.tempId || row.id}
                  processRowUpdate={handleProcessRowUpdate}
                  onProcessRowUpdateError={handleProcessRowError}
                  disableRowSelectionOnClick
                  slots={{ toolbar: GridToolbar }}
                  slotProps={{
                    toolbar: {
                      showQuickFilter: true,
                      quickFilterProps: { debounceMs: 300 },
                    },
                  }}
                  density="compact"
                  sx={(t) => ({
                    "& .MuiDataGrid-toolbarContainer": {
                      backgroundColor: t.palette.background.paper,
                      borderBottom: `1px solid ${t.palette.divider}`,
                    },
                    "& .MuiDataGrid-columnHeaders": {
                      backgroundColor: t.palette.background.paper,
                      borderBottom: `1px solid ${t.palette.divider}`,
                    },
                    "& .MuiDataGrid-virtualScroller, & .MuiDataGrid-virtualScrollerContent, & .MuiDataGrid-footerContainer":
                      {
                        backgroundColor: t.palette.background.paper,
                      },
                    "& .MuiDataGrid-cell": { borderColor: t.palette.divider },
                  })}
                />
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  variant="outlined"
                  color="primary"
                  size="medium"
                  onClick={() => setMultiRows([])}
                  disabled={isSubmittingMulti}
                  fullWidth
                >
                  Clear Preview
                </Button>
                <Tooltip title="Validates and shows summary before committing">
                  <span>
                    <Button
                      variant="contained"
                      color="primary"
                      size="medium"
                      onClick={handlePrepareCommit}
                      disabled={isSubmittingMulti}
                      fullWidth
                      startIcon={
                        isSubmittingMulti ? (
                          <CircularProgress size={18} />
                        ) : (
                          <RocketLaunchIcon />
                        )
                      }
                    >
                      {isSubmittingMulti
                        ? "Committing…"
                        : `Commit ${multiRows.length} Rides`}
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
        return renderSingleRide();
      case 1:
        return renderBuilder();
      case 2:
        return (
          <Paper elevation={2} sx={SECTION_PAPER_SX}>
            <Suspense fallback={lazyGridFallback}>
              <LiveRidesGrid />
            </Suspense>
          </Paper>
        );
      case 3:
        return (
          <Paper elevation={2} sx={SECTION_PAPER_SX}>
            <Suspense fallback={lazyGridFallback}>
              <RideQueueGrid />
            </Suspense>
          </Paper>
        );
      case 4:
        return (
          <Paper elevation={2} sx={SECTION_PAPER_SX}>
            <Suspense fallback={lazyGridFallback}>
              <ClaimedRidesGrid />
            </Suspense>
          </Paper>
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
