/* Proprietary and confidential. See LICENSE. */
// src/components/RideEntryForm.jsx
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  useMediaQuery,
  Fade,
} from "@mui/material";
import Grid2 from "@mui/material/Grid";
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

import dayjs, { isValidDayjs } from "../utils/dates"; // ← our extended dayjs
import { toISOorNull, toTimestampOrNull } from "../utils/dateSafe";
import logError from "../utils/logError.js";
import useAuth from "../hooks/useAuth.js";
import useRides from "../hooks/useRides";
import { callDropDailyRidesNow } from "../utils/functions";
import { useDriver } from "../context/DriverContext.jsx";
import { TIMEZONE, COLLECTIONS } from "../constants";
import { RIDE_TYPES, VEHICLES } from "../constants/rides";

import DropDailyWidget from "./DropDailyWidget";
import ClaimedRidesGrid from "./ClaimedRidesGrid";
import RideQueueGrid from "./RideQueueGrid";
import LiveRidesGrid from "./LiveRidesGrid";
import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";
import ResponsiveScrollBox from "./datagrid/ResponsiveScrollBox.jsx";

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

const tripIdPattern = /^[A-Z0-9]{4}-[A-Z0-9]{2}$/;
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
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        alignItems="center"
      >
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
      </Stack>
      {showError && (
        <FormHelperText error sx={{ mt: 0.5 }}>
          Required
        </FormHelperText>
      )}
    </Box>
  );
}

function RideBuilderFields({
  value,
  onChange,
  rideTypeOptions,
  vehicleOptions,
  disableTripId = false,
}) {
  const [touched, setTouched] = useState({});
  const mark = (k) => () => setTouched((s) => ({ ...s, [k]: true }));
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });

  const tripIdError =
    !!value.tripId && !/^[A-Z0-9]{4}-[A-Z0-9]{2}$/.test(value.tripId);

  // coerce numbers but allow "" for controlled inputs
  const hours = value.hours === "" ? "" : Number(value.hours);
  const minutes = value.minutes === "" ? "" : Number(value.minutes);

  const shortNumberProps = {
    ...FIELD_PROPS,
    type: "number",
    inputProps: { min: 0, max: 59, inputMode: "numeric", pattern: "[0-9]*" },
    sx: { maxWidth: 120 }, // <- keep both the same visual width
  };

  return (
    <Grid2 container spacing={{ xs: 1.5, sm: 2, md: 3 }}>
      {/* Row 1: Trip ID (full width) */}
      <Grid2 xs={12}>
        <TextField
          {...FIELD_PROPS}
          label="Trip ID"
          value={value.tripId || ""}
          onBlur={mark("tripId")}
          onChange={(e) =>
            onChange({ ...value, tripId: e.target.value.toUpperCase() })
          }
          placeholder="e.g., 6K5G-RS"
          disabled={disableTripId}
          error={touched.tripId && (!!tripIdError || !value.tripId)}
          helperText={
            touched.tripId &&
            (!value.tripId ? "Required" : tripIdError ? "Format: ABCD-12" : " ")
          }
        />
      </Grid2>

      {/* Row 2: Pickup At, Duration (H/M short & same width) */}
      <Grid2 xs={12} sm={6} md={4}>
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
          ampm={true}
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
            },
          }}
        />
      </Grid2>

      <Grid2 xs={12} sm="auto">
        <TextField
          {...shortNumberProps}
          label="Duration Hours"
          value={hours}
          onBlur={mark("hours")}
          onChange={(e) => {
            const v =
              e.target.value === ""
                ? ""
                : Math.min(24, Math.max(0, Number(e.target.value)));
            onChange({ ...value, hours: v });
          }}
          helperText={touched.hours && (hours === "" ? "Required" : " ")}
          error={touched.hours && (hours === "" || hours < 0 || hours > 24)}
        />
      </Grid2>

      <Grid2 xs={12} sm="auto">
        <TextField
          {...shortNumberProps}
          label="Duration Minutes"
          value={minutes}
          onBlur={mark("minutes")}
          onChange={(e) => {
            const v =
              e.target.value === ""
                ? ""
                : Math.min(59, Math.max(0, Number(e.target.value)));
            onChange({ ...value, minutes: v });
          }}
          helperText={touched.minutes && (minutes === "" ? "Required" : " ")}
          error={
            touched.minutes && (minutes === "" || minutes < 0 || minutes > 59)
          }
        />
      </Grid2>

      {/* Row 3: Ride Type (full width) */}
      <Grid2 xs={12}>
        <ChipSelect
          label="Ride Type"
          options={rideTypeOptions}
          value={value.rideType || ""}
          onChange={(v) => onChange({ ...value, rideType: v })}
          required
          error={touched.rideType}
        />
      </Grid2>

      {/* Row 4: Vehicle (full width) */}
      <Grid2 xs={12}>
        <ChipSelect
          label="Vehicle"
          options={vehicleOptions}
          value={value.vehicle || ""}
          onChange={(v) => onChange({ ...value, vehicle: v })}
          required
          error={touched.vehicle}
        />
      </Grid2>

      {/* Row 5: Notes (full width) */}
      <Grid2 xs={12}>
        <TextField
          {...FIELD_PROPS}
          multiline
          minRows={3}
          label="Ride Notes"
          value={value.notes || ""}
          onChange={set("notes")}
          placeholder="Optional notes"
        />
      </Grid2>
    </Grid2>
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

  const isMobile = useMediaQuery("(max-width:600px)");
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
              setUploadedRows(results.data);
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
    if (data.TripID && !tripIdPattern.test(data.TripID)) errors.TripID = true;

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
        msg: `Imported ${s.imported} | Duplicates ${s.duplicatesFound} | Skipped ${s.skippedNoTripId} | Queue cleared ${s.queueCleared}`,
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
    setUploadedRows((prev) => [...prev, csvBuilder]);
    setCsvBuilder(defaultValues);
  }, [csvBuilder, validateFields]);

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
    const tripOK = /^[A-Z0-9]{4}-[A-Z0-9]{2}$/.test(formData.TripID || "");
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
    <Grid2
      container
      spacing={{ xs: 1.5, sm: 2, md: 3 }}
      sx={{ mb: isMobile ? 2 : 3 }}
    >
      <Grid2 xs={12} md={4}>
        <Button
          variant="outlined"
          fullWidth
          startIcon={<DownloadIcon />}
          onClick={handleDownloadTemplate}
        >
          Download Template
        </Button>
      </Grid2>
      <Grid2 xs={12} md={8}>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderStyle: "dashed",
            textAlign: "center",
            cursor: "pointer",
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
      </Grid2>
    </Grid2>
  );

  // ---------- Render ----------
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ maxWidth: 1180, mx: "auto", p: isMobile ? 2 : 3 }}>
        <Paper
          elevation={3}
          sx={{
            p: isMobile ? 2 : 3,
            mb: isMobile ? 3 : 4,
            bgcolor: (t) =>
              t.palette.mode === "dark"
                ? "background.paper"
                : "background.default",
            borderRadius: 3,
          }}
        >
          <Typography variant="h6" fontWeight={700} gutterBottom>
            🚐 Ride Entry
          </Typography>

          <Tabs
            value={rideTab}
            onChange={(e, v) => setRideTab(v)}
            TabIndicatorProps={{ style: { backgroundColor: "#00c853" } }}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              mb: 3,
              "& .MuiTab-root": { fontWeight: 600 },
            }}
          >
            <Tab label="SINGLE RIDE" />
            <Tab label="MULTI RIDE UPLOAD" />
          </Tabs>
        </Paper>

        {/* SINGLE RIDE TAB */}
        {rideTab === 0 && (
          <Paper
            elevation={3}
            sx={{ p: isMobile ? 2 : 3, borderRadius: 3, mb: isMobile ? 2 : 3 }}
          >
            <Typography variant="h6" fontWeight={700} gutterBottom>
              SINGLE RIDE
            </Typography>

            <RideBuilderFields
              value={singleRide}
              onChange={setSingleRide}
              rideTypeOptions={rideTypeOptions}
              vehicleOptions={vehicleOptions}
            />

            <Stack
              direction={isMobile ? "column" : "row"}
              spacing={isMobile ? 1.5 : 2}
              sx={{ mt: isMobile ? 2 : 3 }}
              alignItems={isMobile ? "stretch" : "center"}
            >
              <Button
                variant="outlined"
                onClick={onResetSingle}
                sx={{ minHeight: 48 }}
                fullWidth={isMobile}
              >
                Reset
              </Button>
              <Box sx={{ flexGrow: 1, display: isMobile ? "none" : "block" }} />
              <Button
                variant="contained"
                color="success"
                onClick={onSubmitSingle}
                sx={{ minHeight: 48 }}
                disabled={singleSubmitting || !isSingleValid}
                startIcon={<RocketLaunchIcon />}
                fullWidth={isMobile}
              >
                Submit
              </Button>
            </Stack>
          </Paper>
        )}

        {/* MULTI RIDE UPLOAD TAB */}
        {rideTab === 1 && (
          <>
            <Paper
              elevation={3}
              sx={{
                p: isMobile ? 2 : 3,
                borderRadius: 3,
                mb: isMobile ? 2 : 3,
              }}
            >
              <Typography variant="h6" fontWeight={700} gutterBottom>
                MULTI RIDE UPLOAD
              </Typography>

              <TextField
                {...FIELD_PROPS}
                multiline
                minRows={6}
                maxRows={16}
                label="Paste CSV Rides"
                placeholder="tripId, yyyy-mm-dd, hh:mm, hours, minutes, rideType, vehicle, notes"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                sx={{
                  mb: 3,
                  "& textarea": {
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",
                  },
                }}
                helperText="Tip: paste multiple lines; we’ll validate before submit."
              />

              {dropZone}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                Or Use Ride Builder
              </Typography>

              <RideBuilderFields
                value={builder}
                onChange={setBuilder}
                rideTypeOptions={rideTypeOptions}
                vehicleOptions={vehicleOptions}
              />

              <Stack
                direction={isMobile ? "column" : "row"}
                spacing={isMobile ? 1.5 : 2}
                sx={{ mt: isMobile ? 2 : 3 }}
                alignItems={isMobile ? "stretch" : "center"}
              >
                <Button
                  variant="outlined"
                  onClick={onAddToList}
                  startIcon={<AddIcon />}
                  sx={{ minHeight: 48 }}
                  fullWidth={isMobile}
                >
                  Add to List
                </Button>
                <Box
                  sx={{ flexGrow: 1, display: isMobile ? "none" : "block" }}
                />
                <Button
                  variant="contained"
                  color="success"
                  onClick={onSubmitAll}
                  startIcon={<RocketLaunchIcon />}
                  sx={{ minHeight: 48 }}
                  disabled={submitDisabled}
                  fullWidth={isMobile}
                >
                  Submit All Rides
                </Button>
              </Stack>
            </Paper>

            {uploadedRows.length > 0 && (
              <Box mt={4}>
                <Typography variant="subtitle1" fontWeight={600} mb={1}>
                  Preview Rides ({uploadedRows.length})
                </Typography>
                {isMobile && (
                  <Box
                    textAlign="center"
                    py={1}
                    sx={{
                      bgcolor: (t) => t.palette.warning.light,
                      color: (t) => t.palette.warning.dark,
                    }}
                  >
                    👉 Swipe horizontally to view more columns
                  </Box>
                )}
                <ResponsiveScrollBox>
                  <Paper
                    sx={{ width: "100%", overflow: "auto", minWidth: 600 }}
                  >
                    <SmartAutoGrid
                      autoHeight
                      rows={
                        Array.isArray(uploadedRows)
                          ? uploadedRows.map((r, i) => ({
                              id: i,
                              ...(r || {}),
                            }))
                          : []
                      }
                      columnsCompat={expectedCsvCols.map((col) => ({
                        field: col,
                        headerName: col.replace(/([A-Z])/g, " $1"),
                        flex: 1,
                        minWidth: 140,
                        valueFormatter: vfText,
                      }))}
                      pageSizeOptions={[5]}
                      disableRowSelectionOnClick
                      loading={false}
                      checkboxSelection={false}
                      showToolbar
                    />
                  </Paper>
                </ResponsiveScrollBox>
                <Button
                  variant="outlined"
                  color="success"
                  onClick={handleImportConfirm}
                  disabled={submitting}
                  sx={{ mt: 2, fontWeight: 600 }}
                  startIcon={
                    submitting ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <UploadFileIcon />
                    )
                  }
                  fullWidth={isMobile}
                >
                  Import Rides
                </Button>
              </Box>
            )}
          </>
        )}

        {/* Admin: daily drop + status */}
        <Box sx={{ mb: 2 }}>
          <Stack
            direction={isMobile ? "column" : "row"}
            spacing={isMobile ? 1.5 : 2}
            alignItems="stretch"
          >
            {isAdmin && (
              <Tooltip title="Run daily drop now (admin only)">
                <span>
                  <Button
                    variant="contained"
                    color="warning"
                    startIcon={<RocketLaunchIcon />}
                    onClick={onDropNow}
                    disabled={dropping}
                    fullWidth={isMobile}
                  >
                    {dropping ? "Running…" : "Drop Daily Rides Now"}
                  </Button>
                </span>
              </Tooltip>
            )}
            <Box sx={{ flex: 1, minWidth: 320, mt: isMobile ? 2 : 0 }}>
              <Accordion
                expanded={dropOpen}
                onChange={(_, exp) => {
                  setDropOpen(exp);
                  localStorage.setItem("dropDailyOpen", String(exp));
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
        </Box>

        {/* Live / Queue / Claimed Tabs */}
        <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
          <Tabs
            value={dataTab}
            onChange={(e, val) => setDataTab(val)}
            TabIndicatorProps={{ style: { backgroundColor: "#00c853" } }}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              flexGrow: 1,
              "& .MuiTab-root": { minWidth: { xs: "auto", sm: 120 } },
            }}
          >
            <Tab
              label={
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Typography
                    fontWeight={600}
                    color={dataTab === 0 ? "success.main" : "inherit"}
                  >
                    LIVE
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
                    QUEUE
                  </Typography>
                  <Badge
                    badgeContent={queueCount}
                    color="primary"
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
                    CLAIMED
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

        <Box sx={{ width: "100%", overflowX: "auto" }}>
          {dataTab === 0 && (
            <Fade in>
              <Box>
                <LiveRidesGrid />
              </Box>
            </Fade>
          )}
          {dataTab === 1 && (
            <Fade in>
              <Box>
                <RideQueueGrid />
              </Box>
            </Fade>
          )}
          {dataTab === 2 && (
            <Fade in>
              <Box>
                <ClaimedRidesGrid />
              </Box>
            </Fade>
          )}
        </Box>

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
                color="success"
                onClick={handleSubmit}
                disabled={saving || !isValidDayjs(pickupAt)}
                startIcon={
                  saving ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : undefined
                }
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
      </Box>
    </LocalizationProvider>
  );
}
