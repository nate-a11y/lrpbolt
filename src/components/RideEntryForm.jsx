/* Proprietary and confidential. See LICENSE. */
// src/components/RideEntryForm.jsx
import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Paper,
  Chip,
  FormHelperText,
  Stack,
  Divider,
  Typography,
  TextField,
  Button,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  CircularProgress,
  Badge,
  Tooltip,
  Fade,
  InputAdornment,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import DownloadIcon from "@mui/icons-material/Download";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import AddIcon from "@mui/icons-material/Add";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { LocalizationProvider, DateTimePicker } from "@mui/x-date-pickers-pro";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import {
  Timestamp,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  limit,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";

import { vfText } from "@/utils/vf";
import { db } from "src/utils/firebaseInit";

import { TIMEZONE, COLLECTIONS } from "../constants";
import { RIDE_TYPES, VEHICLES } from "../constants/rides";
import { useDriver } from "../context/DriverContext.jsx";
import useAuth from "../hooks/useAuth.js";
import useRides from "../hooks/useRides";
import { toISOorNull, toTimestampOrNull } from "../utils/dateSafe";
import dayjs, { isValidDayjs } from "../utils/dates"; // ← our extended dayjs
import { formatTripId, isTripIdValid } from "../utils/formatters";
import { callDropDailyRidesNow } from "../utils/functions";
import logError from "../utils/logError.js";

import DropDailyWidget from "./DropDailyWidget";
import ClaimedRidesGrid from "./ClaimedRidesGrid";
import RideQueueGrid from "./RideQueueGrid";
import LiveRidesGrid from "./LiveRidesGrid";
import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";
import ResponsiveContainer from "./responsive/ResponsiveContainer.jsx";

// --- Shared field props ---
const FIELD_PROPS = {
  size: "medium",
  fullWidth: true,
  InputLabelProps: { shrink: true },
};

const defaultValues = {
  TripID: "",
  Date: "",
  PickupTime: "",
  PickupAt: "",
  DurationHours: "",
  DurationMinutes: "",
  RideType: "",
  Vehicle: "",
  RideNotes: "",
};

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const expectedCsvCols = [
  "TripID",
  "Date",
  "PickupTime",
  "DurationHours",
  "DurationMinutes",
  "RideType",
  "Vehicle",
  "RideNotes",
];

const SECTION_PAPER_SX = {
  borderRadius: 3,
  p: { xs: 2, sm: 3 },
  bgcolor: (theme) =>
    theme.palette.mode === "dark" ? "background.paper" : "background.default",
  display: "flex",
  flexDirection: "column",
  gap: { xs: 2, sm: 2.5 },
};

const TAB_INDICATOR_PROPS = {
  sx: { backgroundColor: "primary.main" },
};

function toInt(v, fallback = 0) {
  const n = Number.parseInt(String(v).replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : fallback;
}
function clampHours(v) {
  return Math.max(0, toInt(v, 0));
}
function clampMinutes(v) {
  const n = Math.max(0, toInt(v, 0));
  return Math.min(59, n);
}

/* ------------------ Reusable builder (chips) ------------------ */
function ChipSelect({
  label,
  options,
  value,
  onChange,
  disabled,
  required = false,
  error = false,
}) {
  const normalized = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  const showError = required && error && !value;

  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          textTransform: "uppercase",
          mb: 0.5,
          display: "block",
        }}
      >
        {label}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {normalized.map((opt) => {
          const selected = value === opt.value;
          return (
            <Chip
              key={opt.value}
              label={opt.label}
              clickable
              color={selected ? "primary" : showError ? "error" : "default"}
              variant={selected ? "filled" : "outlined"}
              onClick={() => !disabled && onChange(opt.value)}
              disabled={disabled}
              sx={{ fontWeight: 700 }}
            />
          );
        })}
      </Box>
      {showError && (
        <FormHelperText error sx={{ mt: 0.5 }}>
          Required
        </FormHelperText>
      )}
    </Box>
  );
}

const DurationFields = memo(function DurationFields({
  hours = 0,
  minutes = 0,
  onHoursChange,
  onMinutesChange,
  disabled = false,
  hoursLabel = "Hours",
  minutesLabel = "Minutes",
}) {
  return (
    <>
      <Grid item xs={6} md={3}>
        <TextField
          fullWidth
          label={hoursLabel}
          value={Number.isFinite(hours) ? hours : 0}
          onChange={(e) => onHoursChange?.(clampHours(e.target.value))}
          type="number"
          inputMode="numeric"
          inputProps={{
            min: 0,
            step: 1,
            "aria-label": "Ride duration hours",
            pattern: "[0-9]*",
          }}
          disabled={disabled}
          InputProps={{
            endAdornment: <InputAdornment position="end">h</InputAdornment>,
          }}
        />
      </Grid>
      <Grid item xs={6} md={3}>
        <TextField
          fullWidth
          label={minutesLabel}
          value={Number.isFinite(minutes) ? minutes : 0}
          onChange={(e) => onMinutesChange?.(clampMinutes(e.target.value))}
          type="number"
          inputMode="numeric"
          inputProps={{
            min: 0,
            max: 59,
            step: 1,
            "aria-label": "Ride duration minutes",
            pattern: "[0-9]*",
          }}
          disabled={disabled}
          InputProps={{
            endAdornment: <InputAdornment position="end">m</InputAdornment>,
          }}
        />
      </Grid>
    </>
  );
});

function RideBuilderFields({
  value,
  onChange,
  rideTypeOptions,
  vehicleOptions,
  disableTripId = false,
  disabled = false,
}) {
  const [touched, setTouched] = useState({});
  const mark = (k) => () => setTouched((s) => ({ ...s, [k]: true }));
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });

  const tripIdError = !!value.tripId && !isTripIdValid(value.tripId);
  return (
    <>
      <Grid item xs={12} md={6}>
        <TextField
          {...FIELD_PROPS}
          label="Trip ID"
          value={value.tripId || ""}
          onBlur={mark("tripId")}
          onChange={(e) =>
            onChange({ ...value, tripId: formatTripId(e.target.value) })
          }
          placeholder="e.g., 6K5G-RS"
          disabled={disableTripId}
          error={touched.tripId && (!!tripIdError || !value.tripId)}
          helperText={
            touched.tripId &&
            (!value.tripId ? "Required" : tripIdError ? "Format: ABCD-12" : " ")
          }
          inputProps={{
            maxLength: 7,
            inputMode: "text",
            "aria-label": "Trip ID (format XXXX-XX)",
          }}
          sx={{ "& input": { letterSpacing: "0.08em", fontWeight: 600 } }}
        />
      </Grid>

      <Grid item xs={12} md={6}>
        <DateTimePicker
          label="Pickup At"
          value={value.pickupAt}
          onChange={(val) => {
            if (!val || !val.isValid()) {
              onChange({ ...value, pickupAt: null });
              return;
            }
            onChange({ ...value, pickupAt: val.second(0).millisecond(0) });
          }}
          ampm
          minutesStep={5}
          slotProps={{
            textField: {
              ...FIELD_PROPS,
              onBlur: () => {
                mark("pickupAt")();
                if (value.pickupAt && !value.pickupAt.isValid())
                  onChange({ ...value, pickupAt: null });
              },
              error: touched.pickupAt && !value.pickupAt,
              helperText:
                touched.pickupAt && !value.pickupAt ? "Required" : " ",
              placeholder: "MM/DD/YYYY hh:mm A",
              inputProps: {
                "aria-label": "Pickup At",
              },
            },
          }}
        />
      </Grid>

      <DurationFields
        hours={Number.isFinite(Number(value.hours)) ? Number(value.hours) : 0}
        minutes={
          Number.isFinite(Number(value.minutes)) ? Number(value.minutes) : 0
        }
        onHoursChange={(v) => onChange({ ...value, hours: v })}
        onMinutesChange={(v) => onChange({ ...value, minutes: v })}
        disabled={disabled}
      />

      <Grid item xs={12} md={6} sx={{ minWidth: 0 }}>
        <ChipSelect
          label="RIDE TYPE"
          options={rideTypeOptions}
          value={value.rideType || ""}
          onChange={(v) => onChange({ ...value, rideType: v })}
          required
          error={touched.rideType}
        />
      </Grid>
      <Grid item xs={12} md={6} sx={{ minWidth: 0 }}>
        <ChipSelect
          label="VEHICLE"
          options={vehicleOptions}
          value={value.vehicle || ""}
          onChange={(v) => onChange({ ...value, vehicle: v })}
          required
          error={touched.vehicle}
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          {...FIELD_PROPS}
          multiline
          minRows={3}
          label="Ride Notes"
          value={value.notes || ""}
          onChange={set("notes")}
          placeholder="Optional notes"
          inputProps={{ "aria-label": "Ride Notes" }}
        />
      </Grid>
    </>
  );
}

/* ------------------ /Reusable builder ------------------ */

export default function RideEntryForm() {
  // ---------- Core form state ----------
  const [formData, setFormData] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("rideForm")) || {};
      stored.RideType ??= "";
      stored.Vehicle ??= "";
      return { ...defaultValues, ...stored };
    } catch (err) {
      logError(err, "RideEntryForm:init");
      return defaultValues;
    }
  });
  const [pickupAt, setPickupAt] = useState(() =>
    formData.PickupAt ? dayjs(formData.PickupAt) : null,
  );
  const [durationHours, setDurationHours] = useState(
    formData.DurationHours === "" ? 0 : Number(formData.DurationHours),
  );
  const [durationMinutes, setDurationMinutes] = useState(
    formData.DurationMinutes === "" ? 0 : Number(formData.DurationMinutes),
  );
  const [saving, setSaving] = useState(false);

  // UX state for validation (Single tab)
  const errorFields = useRef({});

  // CSV builder / bulk (Multi tab)
  const [csvBuilder, setCsvBuilder] = useState(defaultValues);

  const [uploadedRows, setUploadedRows] = useState([]);
  const [csvText, setCsvText] = useState("");
  const [fileError, setFileError] = useState("");

  // UI state
  const [formToast, setFormToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [rideTab, setRideTab] = useState(() =>
    Number(localStorage.getItem("rideTab") || 0),
  );
  const [dataTab, setDataTab] = useState(() =>
    Number(localStorage.getItem("dataTab") || 0),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [dropOpen, setDropOpen] = useState(
    () => localStorage.getItem("dropDailyOpen") === "true",
  );

  const { user, authLoading } = useAuth();
  const currentUser = user?.email || "Unknown";

  const { counts, fetchRides } = useRides();
  const { live: liveCount, claimed: claimedCount, queue: queueCount } = counts;

  // Admin-only daily drop callable
  const [dropping, setDropping] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    msg: "",
    severity: "success",
  });
  const { driver } = useDriver();
  const isAdmin = (driver?.access || "").toLowerCase() === "admin";

  if (import.meta.env.DEV) {
    pickupAt &&
      console.debug(
        "[RideEntryForm] pickup",
        pickupAt.format("YYYY-MM-DD HH:mm"),
      );
  }

  // Dropzone
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: useCallback(
      (accepted) => {
        setFileError("");
        const file = accepted[0];
        if (!file) return;
        const ext = file.name.split(".").pop().toLowerCase();
        if (!["csv"].includes(ext)) {
          setFileError("Unsupported file type (use .csv)");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          Papa.parse(reader.result, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              const missing = expectedCsvCols.filter(
                (c) => !results.meta.fields?.includes(c),
              );
              if (missing.length) {
                setFormToast({
                  open: true,
                  message: `⚠️ Missing columns: ${missing.join(", ")}`,
                  severity: "warning",
                });
                return;
              }
              setUploadedRows(
                results.data.map((r) => ({ id: crypto.randomUUID(), ...r })),
              );
            },
            error: (err) => setFileError(err?.message || JSON.stringify(err)),
          });
        };
        reader.readAsText(file);
      },
      [setFormToast],
    ),
  });

  // ---------- Validation ----------
  const validateFields = useCallback((data, setErrors, skipRef = false) => {
    const required = [
      "TripID",
      "Date",
      "PickupTime",
      "DurationHours",
      "DurationMinutes",
      "RideType",
      "Vehicle",
    ];
    const errors = {};

    for (const field of required) {
      if (!data[field]?.toString().trim()) errors[field] = true;
    }

    // Trip ID format XXXX-XX
    if (data.TripID && !isTripIdValid(data.TripID)) errors.TripID = true;

    // Date must be valid and NOT in the past (today OK)
    const dateValid = dayjs(data.Date, "YYYY-MM-DD", true).isValid();
    if (!dateValid || dayjs(data.Date).isBefore(dayjs().startOf("day"))) {
      errors.Date = true;
    }

    // Time 24h HH:mm
    if (data.PickupTime && !timePattern.test(data.PickupTime)) {
      errors.PickupTime = true;
    }

    // Duration — must be >=0 and total > 0
    const hours = isNaN(+data.DurationHours) ? 0 : +data.DurationHours;
    const minutes = isNaN(+data.DurationMinutes) ? 0 : +data.DurationMinutes;

    if (hours < 0) errors.DurationHours = true;
    if (minutes < 0 || minutes >= 60) errors.DurationMinutes = true;

    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes <= 0) {
      errors.DurationHours = true;
      errors.DurationMinutes = true;
    }

    if (setErrors) setErrors(errors);
    else if (!skipRef) errorFields.current = errors;

    return Object.keys(errors).length === 0;
  }, []);

  // ---------- Effects ----------
  useEffect(() => {
    const toStore = {
      ...formData,
      PickupAt: toISOorNull(pickupAt),
      DurationHours: durationHours === "" ? "" : durationHours,
      DurationMinutes: durationMinutes === "" ? "" : durationMinutes,
    };
    localStorage.setItem("rideForm", JSON.stringify(toStore));
  }, [formData, pickupAt, durationHours, durationMinutes]);

  useEffect(() => {
    localStorage.setItem("rideTab", rideTab.toString());
  }, [rideTab]);

  useEffect(() => {
    localStorage.setItem("dataTab", dataTab.toString());
  }, [dataTab]);

  useEffect(() => {
    try {
      localStorage.setItem("lrp_sync_time", dayjs().format("hh:mm A"));
    } catch {
      // ignore storage errors
    }
  }, [counts]);

  // ---------- Handlers ----------
  const toRideDoc = useCallback(
    (row) => {
      const clean = {
        TripID: row.TripID?.toString().trim() || "",
        Date: row.Date?.toString().trim() || "",
        PickupTime: row.PickupTime?.toString().trim() || "",
        DurationHours: row.DurationHours?.toString().trim() || "",
        DurationMinutes: row.DurationMinutes?.toString().trim() || "",
        RideType: row.RideType?.toString().trim() || "",
        Vehicle: row.Vehicle?.toString().trim() || "",
        RideNotes: row.RideNotes?.toString().trim() || "",
      };
      if (!validateFields(clean, null, true)) return null;

      const rideDuration =
        Number(clean.DurationHours || 0) * 60 +
        Number(clean.DurationMinutes || 0);

      const pickupTimestamp = Timestamp.fromDate(
        dayjs
          .tz(`${clean.Date} ${clean.PickupTime}`, "YYYY-MM-DD HH:mm", TIMEZONE)
          .toDate(),
      );

      return {
        tripId: clean.TripID,
        pickupTime: pickupTimestamp,
        rideDuration,
        rideType: clean.RideType,
        vehicle: clean.Vehicle,
        rideNotes: clean.RideNotes || null,
        claimedBy: null,
        claimedAt: null,
        createdBy: currentUser,
        lastModifiedBy: currentUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
    },
    [validateFields, currentUser],
  );

  // --- Duplicate guards: reject if tripId exists in Queue or Live ---
  const tripExistsInQueue = useCallback(
    async (tripId) => {
      if (authLoading || !user) return false;
      const qy = query(
        collection(db, COLLECTIONS.RIDE_QUEUE),
        where("tripId", "==", tripId),
        limit(1),
      );
      const snap = await getDocs(qy);
      return !snap.empty;
    },
    [authLoading, user],
  );

  const tripExistsInLive = useCallback(
    async (tripId) => {
      if (authLoading || !user) return false;
      const qy = query(
        collection(db, COLLECTIONS.LIVE_RIDES),
        where("tripId", "==", tripId),
        limit(1),
      );
      const snap = await getDocs(qy);
      return !snap.empty;
    },
    [authLoading, user],
  );

  const tripExistsAnywhere = useCallback(
    async (tripId) => {
      const [inQueue, inLive] = await Promise.all([
        tripExistsInQueue(tripId),
        tripExistsInLive(tripId),
      ]);
      return inQueue || inLive;
    },
    [tripExistsInQueue, tripExistsInLive],
  );

  const processRideRows = useCallback(
    async (rows) => {
      const docs = [];
      let skipped = 0;

      for (const row of rows) {
        const d = toRideDoc(row);
        if (d) docs.push(d);
        else skipped++;
      }

      // Filter duplicates: in-file and in DB (Queue or Live)
      const seen = new Set();
      const filtered = [];
      for (const d of docs) {
        if (seen.has(d.tripId)) {
          skipped++;
          continue;
        }
        seen.add(d.tripId);

        if (await tripExistsAnywhere(d.tripId)) {
          skipped++;
          continue;
        }
        filtered.push(d);
      }

      // Write in chunks of 500
      const CHUNK = 500;
      for (let i = 0; i < filtered.length; i += CHUNK) {
        const batch = writeBatch(db);
        filtered.slice(i, i + CHUNK).forEach((d) => {
          const ref = doc(collection(db, COLLECTIONS.RIDE_QUEUE));
          batch.set(ref, d);
        });

        await batch.commit();
      }

      return { added: filtered.length, skipped };
    },
    [toRideDoc, tripExistsAnywhere],
  );

  const onDropNow = async () => {
    setDropping(true);
    try {
      const { ok, stats } = await callDropDailyRidesNow({ dryRun: false });
      if (!ok) throw new Error("Drop failed");
      const s = stats || {};
      setToast({
        open: true,
        severity: "success",
        msg: `Imported ${s.imported ?? 0} | Updated ${s.updatedExisting ?? 0} | Duplicates ${s.duplicatesFound ?? 0} | Skipped (no TripID) ${s.skippedNoTripId ?? 0} | Skipped (claimed live) ${s.skippedClaimedLive ?? 0} | Queue cleared ${s.queueCleared ?? 0}`,
      });
    } catch (e) {
      console.error(e);
      setToast({
        open: true,
        severity: "error",
        msg: "Drop failed. See logs.",
      });
    } finally {
      setDropping(false);
    }
  };

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.();

      if (!isValidDayjs(pickupAt)) {
        setFormToast({
          open: true,
          message: "⚠️ Please correct required fields",
          severity: "error",
        });
        return;
      }

      setSaving(true);
      try {
        const minutes =
          (Number(durationHours) || 0) * 60 + (Number(durationMinutes) || 0);

        // (A) Store ISO strings:
        // const payload = {
        //   tripId: formData.TripID,
        //   pickupAtISO: toISOorNull(pickupAt),
        //   durationMinutes: minutes,
        //   rideType: formData.RideType,
        //   vehicle: formData.Vehicle,
        //   rideNotes: formData.RideNotes || null,
        //   claimedBy: null,
        //   claimedAt: null,
        //   createdBy: currentUser,
        //   lastModifiedBy: currentUser,
        //   createdAt: serverTimestamp(),
        //   updatedAt: serverTimestamp(),
        // };

        // (B) Or store Firestore Timestamp directly:
        const payload = {
          tripId: formData.TripID,
          pickupTime: toTimestampOrNull(pickupAt),
          rideDuration: minutes,
          rideType: formData.RideType,
          vehicle: formData.Vehicle,
          rideNotes: formData.RideNotes || null,
          claimedBy: null,
          claimedAt: null,
          createdBy: currentUser,
          lastModifiedBy: currentUser,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (await tripExistsAnywhere(payload.tripId)) {
          throw new Error(
            `TripID ${payload.tripId} already exists (Queue/Live).`,
          );
        }
        await addDoc(collection(db, COLLECTIONS.RIDE_QUEUE), payload);
        setFormToast({
          open: true,
          message: `✅ Ride ${formData.TripID} submitted successfully`,
          severity: "success",
        });
        setFormData(defaultValues);
        setPickupAt(null);
        setDurationHours(0);
        setDurationMinutes(0);
        setConfirmOpen(false);
        await fetchRides();
      } catch (err) {
        logError(err, "RideEntryForm:submit");
        setFormToast({
          open: true,
          message: `❌ ${err?.message || JSON.stringify(err)}`,
          severity: "error",
        });
      } finally {
        setSaving(false);
      }
    },
    [
      pickupAt,
      durationHours,
      durationMinutes,
      formData,
      currentUser,
      tripExistsAnywhere,
      fetchRides,
    ],
  );

  const handleImportConfirm = useCallback(async () => {
    if (!uploadedRows.length) {
      setFormToast({
        open: true,
        message: "⚠️ No rows to import",
        severity: "warning",
      });
      return;
    }
    setSubmitting(true);
    try {
      const { added, skipped } = await processRideRows(uploadedRows);
      setFormToast({
        open: true,
        message: `✅ CSV rides imported (${added} added${skipped ? `, ${skipped} skipped` : ""})`,
        severity: "success",
      });
      setUploadedRows([]);
      await fetchRides();
    } catch (err) {
      logError(err, "RideEntryForm:import");
      setFormToast({
        open: true,
        message: `❌ ${err?.message || JSON.stringify(err)}`,
        severity: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [uploadedRows, processRideRows, fetchRides]);

  const handleCsvAppend = useCallback(() => {
    if (!validateFields(csvBuilder)) {
      setFormToast({
        open: true,
        message: "⚠️ Please correct CSV builder fields",
        severity: "error",
      });
      return;
    }
    setUploadedRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), ...csvBuilder },
    ]);
    setCsvBuilder(defaultValues);
  }, [csvBuilder, validateFields]);

  const handlePreviewUpdate = useCallback((row) => {
    setUploadedRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));
    return row;
  }, []);

  const handleDownloadTemplate = () => {
    const sample = {
      TripID: "ABCD-12",
      Date: dayjs().add(1, "day").format("YYYY-MM-DD"),
      PickupTime: "08:00",
      DurationHours: "1",
      DurationMinutes: "30",
      RideType: RIDE_TYPES[0],
      Vehicle: VEHICLES[0],
      RideNotes: "Sample notes",
    };
    const header = expectedCsvCols.join(",");
    const row = expectedCsvCols.map((col) => sample[col]).join(",");
    const csv = `${header}\n${row}\n`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rides-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleMultiSubmit = useCallback(async () => {
    if (!uploadedRows.length && !csvText.trim()) {
      setFormToast({
        open: true,
        message: "⚠️ No rides to submit",
        severity: "warning",
      });
      return;
    }
    const ridesToSubmit = [...uploadedRows];
    if (csvText.trim()) {
      const parsed = Papa.parse(csvText.trim(), {
        header: true,
        skipEmptyLines: true,
      });
      const missing = expectedCsvCols.filter(
        (c) => !parsed.meta.fields?.includes(c),
      );
      if (missing.length) {
        setFormToast({
          open: true,
          message: `⚠️ Missing columns: ${missing.join(", ")}`,
          severity: "warning",
        });
      } else if (parsed.data?.length) {
        ridesToSubmit.push(...parsed.data);
      }
    }
    if (!ridesToSubmit.length) {
      setFormToast({
        open: true,
        message: "⚠️ No valid rides found",
        severity: "warning",
      });
      return;
    }
    setSubmitting(true);
    try {
      const { added, skipped } = await processRideRows(ridesToSubmit);
      setFormToast({
        open: true,
        message: `✅ All rides submitted (${added} added${skipped ? `, ${skipped} skipped` : ""})`,
        severity: "success",
      });
      setUploadedRows([]);
      setCsvText("");
      await fetchRides();
    } catch (err) {
      logError(err, "RideEntryForm:bulkSubmit");
      setFormToast({
        open: true,
        message: `❌ ${err?.message || JSON.stringify(err)}`,
        severity: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [uploadedRows, csvText, processRideRows, fetchRides]);

  const rideTypeOptions = useMemo(
    () => RIDE_TYPES.map((t) => ({ value: t, label: t })),
    [],
  );
  const vehicleOptions = useMemo(
    () => VEHICLES.map((v) => ({ value: v, label: v })),
    [],
  );

  const singleRide = useMemo(
    () => ({
      tripId: formData.TripID,
      pickupAt,
      hours: durationHours,
      minutes: durationMinutes,
      rideType: formData.RideType,
      vehicle: formData.Vehicle,
      notes: formData.RideNotes,
    }),
    [formData, pickupAt, durationHours, durationMinutes],
  );

  const endAt = useMemo(() => {
    if (!isValidDayjs(pickupAt)) return null;
    const minutes =
      (Number(durationHours) || 0) * 60 + (Number(durationMinutes) || 0);
    return pickupAt.add(minutes, "minute");
  }, [pickupAt, durationHours, durationMinutes]);

  const isSingleValid = useMemo(() => {
    const h = Number(durationHours || 0);
    const m = Number(durationMinutes || 0);
    const durOK = h > 0 || m > 0;
    const tripOK = isTripIdValid(formData.TripID);
    return !!(
      tripOK &&
      isValidDayjs(pickupAt) &&
      formData.RideType &&
      formData.Vehicle &&
      durOK
    );
  }, [formData, pickupAt, durationHours, durationMinutes]);

  const setSingleRide = (val) => {
    setFormData((prev) => ({
      ...prev,
      TripID: val.tripId,
      RideType: val.rideType,
      Vehicle: val.vehicle,
      RideNotes: val.notes,
      PickupAt: toISOorNull(val.pickupAt),
    }));
    if ("pickupAt" in val) setPickupAt(val.pickupAt);
    if ("hours" in val) setDurationHours(val.hours);
    if ("minutes" in val) setDurationMinutes(val.minutes);
  };

  const onResetSingle = () => {
    setFormData(defaultValues);
    setPickupAt(null);
    setDurationHours(0);
    setDurationMinutes(0);
  };
  const onSubmitSingle = () => setConfirmOpen(true);
  const singleSubmitting = saving;

  const builder = useMemo(
    () => ({
      tripId: csvBuilder.TripID,
      pickupAt:
        csvBuilder.Date && csvBuilder.PickupTime
          ? dayjs(`${csvBuilder.Date} ${csvBuilder.PickupTime}`)
          : null,
      hours:
        csvBuilder.DurationHours === "" ? "" : Number(csvBuilder.DurationHours),
      minutes:
        csvBuilder.DurationMinutes === ""
          ? ""
          : Number(csvBuilder.DurationMinutes),
      rideType: csvBuilder.RideType,
      vehicle: csvBuilder.Vehicle,
      notes: csvBuilder.RideNotes,
    }),
    [csvBuilder],
  );

  const setBuilder = (val) =>
    setCsvBuilder((prev) => {
      const next = {
        ...prev,
        TripID: val.tripId,
        Date: val.pickupAt ? val.pickupAt.format("YYYY-MM-DD") : "",
        PickupTime: val.pickupAt ? val.pickupAt.format("HH:mm") : "",
        DurationHours: val.hours === "" ? "" : String(val.hours),
        DurationMinutes: val.minutes === "" ? "" : String(val.minutes),
        RideType: val.rideType,
        Vehicle: val.vehicle,
        RideNotes: val.notes,
      };
      validateFields(next);
      return next;
    });

  const onAddToList = handleCsvAppend;
  const onSubmitAll = handleMultiSubmit;
  const submitDisabled = submitting;

  const dropZone = (
    <Grid item xs={12}>
      <Grid container spacing={2} sx={{ mb: { xs: 2, sm: 3 } }}>
        <Grid item xs={12} md={4} sx={{ minWidth: 0 }}>
          <Button
            variant="outlined"
            fullWidth
            startIcon={<DownloadIcon />}
            onClick={handleDownloadTemplate}
            sx={{
              minHeight: 64,
              fontWeight: 700,
            }}
          >
            Download Template
          </Button>
        </Grid>
        <Grid item xs={12} md={8} sx={{ minWidth: 0 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderStyle: "dashed",
              textAlign: "center",
              cursor: "pointer",
              borderRadius: 2,
            }}
            {...getRootProps()}
          >
            <input {...getInputProps()} />
            <CloudUploadIcon fontSize="large" />
            <Typography variant="body2" mt={1}>
              Drag & drop CSV here or click to select
            </Typography>
            {fileError && (
              <Typography color="error" variant="caption">
                {fileError}
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Grid>
  );

  // ---------- Render ----------
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ResponsiveContainer maxWidth={1240}>
        <Stack spacing={{ xs: 2.5, md: 3 }}>
          <Paper
            elevation={3}
            sx={{ ...SECTION_PAPER_SX, gap: { xs: 1.5, sm: 2 } }}
          >
            <Typography variant="h6" fontWeight={700}>
              🚐 Ride Entry
            </Typography>
            <Tabs
              value={rideTab}
              onChange={(event, value) => setRideTab(value)}
              TabIndicatorProps={TAB_INDICATOR_PROPS}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                "& .MuiTab-root": {
                  minWidth: { xs: "auto", sm: 140 },
                  fontWeight: 600,
                },
              }}
            >
              <Tab label="Single Ride" />
              <Tab label="Multi Ride Upload" />
            </Tabs>
          </Paper>

          {rideTab === 0 && (
            <Paper elevation={3} sx={SECTION_PAPER_SX}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    Single Ride
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Grid container spacing={2}>
                    <RideBuilderFields
                      value={singleRide}
                      onChange={setSingleRide}
                      rideTypeOptions={rideTypeOptions}
                      vehicleOptions={vehicleOptions}
                    />
                  </Grid>
                </Grid>

                <Grid item xs={12}>
                  <Divider sx={{ opacity: 0.12 }} />
                </Grid>

                <Grid item xs={12}>
                  <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    sx={{ width: "100%" }}
                  >
                    <Button
                      variant="outlined"
                      color="success"
                      onClick={onResetSingle}
                      disabled={singleSubmitting}
                      sx={{ flex: 1, minWidth: 0 }}
                      aria-label="Reset form"
                    >
                      Reset
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={onSubmitSingle}
                      disabled={singleSubmitting || !isSingleValid}
                      sx={{ flex: 1, minWidth: 0, fontWeight: 700 }}
                      startIcon={<RocketLaunchIcon />}
                      aria-label="Submit ride"
                    >
                      Submit
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </Paper>
          )}

          {rideTab === 1 && (
            <>
              <Paper elevation={3} sx={SECTION_PAPER_SX}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      Multi Ride Upload
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sx={{ minWidth: 0 }}>
                    <TextField
                      {...FIELD_PROPS}
                      multiline
                      minRows={6}
                      maxRows={16}
                      label="Paste CSV Rides"
                      placeholder="tripId, yyyy-mm-dd, hh:mm, hours, minutes, rideType, vehicle, notes"
                      value={csvText}
                      onChange={(event) => setCsvText(event.target.value)}
                      sx={{
                        "& textarea": {
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, monospace",
                        },
                      }}
                      helperText="Tip: paste multiple lines; we’ll validate before submit."
                    />
                  </Grid>

                  {dropZone}

                  <Grid item xs={12}>
                    <Divider />
                  </Grid>

                  <Grid item xs={12}>
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 600, mb: 1 }}
                    >
                      Or Use Ride Builder
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Grid container spacing={2}>
                      <RideBuilderFields
                        value={builder}
                        onChange={setBuilder}
                        rideTypeOptions={rideTypeOptions}
                        vehicleOptions={vehicleOptions}
                      />
                    </Grid>
                  </Grid>

                  <Grid item xs={12}>
                    <Divider sx={{ opacity: 0.12 }} />
                  </Grid>

                  <Grid item xs={12}>
                    <Stack
                      direction="row"
                      spacing={2}
                      alignItems="center"
                      sx={{ width: "100%" }}
                    >
                      <Button
                        variant="outlined"
                        color="success"
                        onClick={onAddToList}
                        disabled={submitDisabled}
                        sx={{ flex: 1, minWidth: 0 }}
                        startIcon={<AddIcon />}
                        aria-label="Add ride to list"
                      >
                        Add to List
                      </Button>
                      <Button
                        variant="contained"
                        color="success"
                        onClick={onSubmitAll}
                        disabled={submitDisabled}
                        sx={{ flex: 1, minWidth: 0, fontWeight: 700 }}
                        startIcon={<RocketLaunchIcon />}
                        aria-label="Submit all rides"
                      >
                        Submit All Rides
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Paper>

              {uploadedRows.length > 0 && (
                <Paper elevation={3} sx={SECTION_PAPER_SX}>
                  <Stack spacing={{ xs: 2, sm: 2.5 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Preview Rides ({uploadedRows.length})
                    </Typography>
                    <Box
                      sx={{
                        display: { xs: "block", sm: "none" },
                        textAlign: "center",
                        py: 1,
                        borderRadius: 2,
                        bgcolor: (theme) => theme.palette.warning.light,
                        color: (theme) => theme.palette.warning.dark,
                        fontWeight: 600,
                      }}
                    >
                      👉 Swipe horizontally to view more columns
                    </Box>
                    <SmartAutoGrid
                      autoHeight
                      rows={Array.isArray(uploadedRows) ? uploadedRows : []}
                      columns={expectedCsvCols.map((col) => ({
                        field: col,
                        headerName: col.replace(/([A-Z])/g, " $1"),
                        flex: 1,
                        minWidth: 140,
                        valueFormatter: vfText,
                        editable: true,
                      }))}
                      getRowId={(row) => row.id}
                      processRowUpdate={handlePreviewUpdate}
                      pageSizeOptions={[5]}
                      disableRowSelectionOnClick
                      loading={false}
                      checkboxSelection
                      containerSx={{
                        borderRadius: 2,
                        border: (theme) => `1px solid ${theme.palette.divider}`,
                      }}
                    />
                    <Button
                      variant="outlined"
                      color="success"
                      onClick={handleImportConfirm}
                      disabled={submitting}
                      sx={{
                        mt: 1,
                        fontWeight: 600,
                        minHeight: 48,
                        width: { xs: "100%", sm: "auto" },
                      }}
                      startIcon={
                        submitting ? (
                          <CircularProgress size={20} color="inherit" />
                        ) : (
                          <UploadFileIcon />
                        )
                      }
                    >
                      Import Rides
                    </Button>
                  </Stack>
                </Paper>
              )}
            </>
          )}

          <Paper elevation={3} sx={SECTION_PAPER_SX}>
            <Stack spacing={{ xs: 2, sm: 2.5 }}>
              <Typography variant="h6" fontWeight={700}>
                Daily Drop
              </Typography>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={{ xs: 1.5, md: 2 }}
                alignItems={{ xs: "stretch", md: "center" }}
              >
                {isAdmin && (
                  <Tooltip title="Run daily drop now (admin only)">
                    <Box sx={{ width: { xs: "100%", md: "auto" } }}>
                      <Button
                        variant="contained"
                        color="warning"
                        startIcon={<RocketLaunchIcon />}
                        onClick={onDropNow}
                        disabled={dropping}
                        sx={{
                          width: "100%",
                          minHeight: 48,
                          fontWeight: 700,
                        }}
                      >
                        {dropping ? "Running…" : "Drop Daily Rides Now"}
                      </Button>
                    </Box>
                  </Tooltip>
                )}
                <Box sx={{ flex: 1, minWidth: { xs: "100%", md: 320 } }}>
                  <Accordion
                    expanded={dropOpen}
                    onChange={(_, expanded) => {
                      setDropOpen(expanded);
                      localStorage.setItem("dropDailyOpen", String(expanded));
                    }}
                    sx={{
                      bgcolor: "background.paper",
                      borderRadius: 2,
                      "&:before": { display: "none" },
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle1" fontWeight={700}>
                          Daily Drop Status
                        </Typography>
                        <Chip
                          size="small"
                          label={dropOpen ? "Collapse" : "Expand"}
                          variant="outlined"
                        />
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                      <DropDailyWidget />
                    </AccordionDetails>
                  </Accordion>
                </Box>
              </Stack>
            </Stack>
          </Paper>

          <Paper
            elevation={3}
            sx={{
              ...SECTION_PAPER_SX,
              p: 0,
              gap: 0,
              overflow: "hidden",
            }}
          >
            <Box sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 3 } }}>
              <Tabs
                value={dataTab}
                onChange={(event, value) => setDataTab(value)}
                TabIndicatorProps={TAB_INDICATOR_PROPS}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                  "& .MuiTab-root": {
                    minWidth: { xs: "auto", sm: 140 },
                    fontWeight: 600,
                  },
                }}
              >
                <Tab
                  label={
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Typography
                        fontWeight={600}
                        color={dataTab === 0 ? "success.main" : "inherit"}
                      >
                        Live
                      </Typography>
                      <Badge
                        badgeContent={liveCount}
                        color="success"
                        sx={{
                          "& .MuiBadge-badge": {
                            transform: "scale(0.8) translate(60%, -40%)",
                            transformOrigin: "top right",
                          },
                        }}
                      />
                    </Box>
                  }
                />
                <Tab
                  label={
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Typography
                        fontWeight={600}
                        color={dataTab === 1 ? "success.main" : "inherit"}
                      >
                        Queue
                      </Typography>
                      <Badge
                        badgeContent={queueCount}
                        color="info"
                        sx={{
                          "& .MuiBadge-badge": {
                            transform: "scale(0.8) translate(60%, -40%)",
                            transformOrigin: "top right",
                          },
                        }}
                      />
                    </Box>
                  }
                />
                <Tab
                  label={
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Typography
                        fontWeight={600}
                        color={dataTab === 2 ? "success.main" : "inherit"}
                      >
                        Claimed
                      </Typography>
                      <Badge
                        badgeContent={claimedCount}
                        color="secondary"
                        sx={{
                          "& .MuiBadge-badge": {
                            transform: "scale(0.8) translate(60%, -40%)",
                            transformOrigin: "top right",
                          },
                        }}
                      />
                    </Box>
                  }
                />
              </Tabs>
            </Box>
            <Box sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2.5, sm: 3 } }}>
              {dataTab === 0 && (
                <Fade in>
                  <Box sx={{ width: "100%" }}>
                    <LiveRidesGrid />
                  </Box>
                </Fade>
              )}
              {dataTab === 1 && (
                <Fade in>
                  <Box sx={{ width: "100%" }}>
                    <RideQueueGrid />
                  </Box>
                </Fade>
              )}
              {dataTab === 2 && (
                <Fade in>
                  <Box sx={{ width: "100%" }}>
                    <ClaimedRidesGrid />
                  </Box>
                </Fade>
              )}
            </Box>
          </Paper>
        </Stack>
      </ResponsiveContainer>

      {/* Confirm Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Ride</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ mb: 0.5 }}>
            <strong>Pickup Time:</strong>{" "}
            {isValidDayjs(pickupAt)
              ? pickupAt.format("MM/DD/YYYY h:mm A")
              : "—"}
          </Typography>
          <Typography sx={{ mb: 0.5 }}>
            <strong>Duration Hours:</strong> {Number(durationHours) || 0}
          </Typography>
          <Typography sx={{ mb: 0.5 }}>
            <strong>Duration Minutes:</strong> {Number(durationMinutes) || 0}
          </Typography>
          <Typography sx={{ mb: 0.5 }}>
            <strong>Trip ID:</strong> {formData.TripID || ""}
          </Typography>
          <Typography sx={{ mb: 0.5 }}>
            <strong>Ride Type:</strong> {formData.RideType || ""}
          </Typography>
          <Typography sx={{ mb: 0.5 }}>
            <strong>Vehicle:</strong> {formData.Vehicle || ""}
          </Typography>
          <Typography sx={{ mb: 0.5 }}>
            <strong>Ride Notes:</strong> {formData.RideNotes || ""}
          </Typography>
          <Typography sx={{ mb: 0.5 }}>
            <strong>End Time:</strong>{" "}
            {endAt?.format?.("MM/DD/YYYY h:mm A") ?? "—"}
          </Typography>
          <Box display="flex" justifyContent="flex-end" gap={2} mt={2}>
            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={saving || !isValidDayjs(pickupAt)}
              startIcon={
                saving ? (
                  <CircularProgress size={18} color="inherit" />
                ) : undefined
              }
              sx={{
                bgcolor: "primary.main",
                "&:hover": { bgcolor: "primary.dark" },
                fontWeight: 700,
                minHeight: 48,
              }}
            >
              {saving ? "Saving…" : "Confirm & Submit"}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Toasts */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>

      <Snackbar
        open={formToast.open}
        autoHideDuration={4000}
        onClose={() => setFormToast({ ...formToast, open: false })}
      >
        <Alert severity={formToast.severity} variant="filled">
          {formToast.message}
        </Alert>
      </Snackbar>
    </LocalizationProvider>
  );
}
