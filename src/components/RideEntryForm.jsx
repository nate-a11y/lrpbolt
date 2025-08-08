/* Proprietary and confidential. See LICENSE. */
// src/components/RideEntryForm.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  MenuItem,
  Paper,
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
  InputAdornment,
} from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LiveRidesGrid from "./LiveRidesGrid";
import RideQueueGrid from "./RideQueueGrid";
import ClaimedRidesGrid from "./ClaimedRidesGrid";
import { formatDuration, toTimeString12Hr } from "../utils/timeUtils";
import { db } from "../firebase";
import { logError } from "../utils/logError";
import useAuth from "../hooks/useAuth.js";
import useRides from "../hooks/useRides";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { TIMEZONE, COLLECTIONS } from "../constants";
import { Timestamp, collection, addDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import Papa from "papaparse";
import {
  LocalizationProvider,
  DatePicker,
  TimePicker,
} from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DataGrid } from "@mui/x-data-grid";
import Grid from "@mui/material/Grid";
import { useDropzone } from "react-dropzone";

dayjs.extend(utc);
dayjs.extend(timezone);

const defaultValues = {
  TripID: "",
  Date: "",
  PickupTime: "",
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

const rideTypeOptions = ["P2P", "Round-Trip", "Hourly"];
const vehicleOptions = [
  "LRPBus - Limo Bus",
  "LRPSHU - Shuttle",
  "LRPSPR - Sprinter",
  "LRPSQD - Rescue Squad",
];

export default function RideEntryForm() {
  // ---------- Core form state ----------
  const [formData, setFormData] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("rideForm")) || defaultValues;
    } catch (err) {
      logError(err, "RideEntryForm:init");
      return defaultValues;
    }
  });

  // UX state for validation (Single tab)
  const errorFields = useRef({});
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // CSV builder / bulk (Multi tab)
  const [csvBuilder, setCsvBuilder] = useState(defaultValues);
  const [builderErrors, setBuilderErrors] = useState({});
  const [builderTouched, setBuilderTouched] = useState({});
  const [builderSubmitAttempted, setBuilderSubmitAttempted] = useState(false);

  const [uploadedRows, setUploadedRows] = useState([]);
  const [multiInput, setMultiInput] = useState("");
  const [fileError, setFileError] = useState("");

  // UI state
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });
  const [rideTab, setRideTab] = useState(() => Number(localStorage.getItem("rideTab") || 0));
  const [dataTab, setDataTab] = useState(() => Number(localStorage.getItem("dataTab") || 0));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncTime, setSyncTime] = useState("");
  const [shakeKey, setShakeKey] = useState(0);

  const isMobile = useMediaQuery("(max-width:600px)");
  const { user } = useAuth();
  const currentUser = user?.email || "Unknown";

  const { counts, fetchRides } = useRides();
  const { live: liveCount, claimed: claimedCount, queue: queueCount } = counts;

  // Cloud Function (daily drop)
  const functions = getFunctions();
  const refreshDrop = httpsCallable(functions, "dropDailyRidesNow");

  // Dropzone
  const DROPZONE_MIN_H = 168;
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback(
      (accepted) => {
        setFileError("");
        const file = accepted[0];
        if (!file) return;
        const ext = file.name.split(".").pop().toLowerCase();
        if (!["csv", "xls", "xlsx"].includes(ext)) {
          setFileError("Unsupported file type");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          Papa.parse(reader.result, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              const missing = expectedCsvCols.filter(
                (c) => !results.meta.fields?.includes(c)
              );
              if (missing.length) {
                setToast({
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
      [setToast]
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

    // Duration
    if (isNaN(+data.DurationHours) || +data.DurationHours < 0) {
      errors.DurationHours = true;
    }
    if (
      isNaN(+data.DurationMinutes) ||
      +data.DurationMinutes < 0 ||
      +data.DurationMinutes >= 60
    ) {
      errors.DurationMinutes = true;
    }

    if (setErrors) setErrors(errors);
    else if (!skipRef) errorFields.current = errors;

    return Object.keys(errors).length === 0;
  }, []);

  // DO NOT mutate errorFields during render
  const isFormValid = useMemo(
    () => validateFields(formData, null, true),
    [formData, validateFields]
  );

  const showErr = useCallback(
    (field) => !!errorFields.current[field] && (touched[field] || submitAttempted),
    [touched, submitAttempted]
  );

  // ---------- Derived preview ----------
  const preview = useMemo(() => {
    const rideDuration = formatDuration(
      formData.DurationHours,
      formData.DurationMinutes
    );
    const formattedDate = formData.Date
      ? dayjs(formData.Date).tz(TIMEZONE).format("M/D/YYYY")
      : "N/A";
    const formattedTime = toTimeString12Hr(formData.PickupTime);
    return {
      ...formData,
      PickupTime: formattedTime,
      Date: formattedDate,
      RideDuration: rideDuration,
    };
  }, [formData]);

  // ---------- Effects ----------
  useEffect(() => {
    localStorage.setItem("rideForm", JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    localStorage.setItem("rideTab", rideTab.toString());
  }, [rideTab]);

  useEffect(() => {
    localStorage.setItem("dataTab", dataTab.toString());
  }, [dataTab]);

  useEffect(() => {
    setSyncTime(dayjs().format("hh:mm A"));
  }, [counts]);

  // ---------- Handlers ----------
  const handleChange = useCallback(
    (e, stateSetter = setFormData, errorSetter) => {
      const { name, value } = e.target;
      let updatedValue = value;

      if (name === "TripID") {
        const cleaned = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        updatedValue =
          cleaned.length > 4
            ? `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}`
            : cleaned;
      }

      stateSetter((prev) => {
        const next = { ...prev, [name]: updatedValue };
        validateFields(next, errorSetter); // live-validate but don't paint until touched/submit
        return next;
      });
    },
    [validateFields]
  );

  const handleSingleChange = (e) => handleChange(e, setFormData);
  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched((t) => ({ ...t, [name]: true }));
  }, []);

  // Builder touched (Multi tab)
  const handleBuilderBlur = useCallback((e) => {
    const { name } = e.target;
    setBuilderTouched((t) => ({ ...t, [name]: true }));
  }, []);

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
        new Date(`${clean.Date}T${clean.PickupTime}`)
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
      };
    },
    [validateFields, currentUser]
  );

  const processRideRows = useCallback(
    async (rows) => {
      const validDocs = [];
      let skipped = 0;
      rows.forEach((row) => {
        const doc = toRideDoc(row);
        if (doc) validDocs.push(doc);
        else skipped++;
      });
      for (const doc of validDocs) {
        await addDoc(collection(db, COLLECTIONS.RIDE_QUEUE), doc);
      }
      return { added: validDocs.length, skipped };
    },
    [toRideDoc]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await refreshDrop({});
      const msg =
        data && typeof data.imported === "number"
          ? `✅ Daily drop executed — added ${data.imported} ride(s)`
          : "✅ Daily drop executed";
      setToast({ open: true, message: msg, severity: "success" });
      await fetchRides();
    } catch (error) {
      logError(error, "RideEntryForm:refresh");
      setToast({
        open: true,
        message: `❌ Refresh failed: ${error?.message || JSON.stringify(error)}`,
        severity: "error",
      });
    } finally {
      setRefreshing(false);
    }
  }, [fetchRides, refreshDrop]);

  const handleSubmit = useCallback(async () => {
    setSubmitAttempted(true);
    if (!validateFields(formData)) {
      setShakeKey((k) => k + 1);
      setToast({
        open: true,
        message: "⚠️ Please correct required fields",
        severity: "error",
      });
      return;
    }
    setSubmitting(true);
    try {
      const rideData = toRideDoc(formData);
      if (!rideData) throw new Error("Invalid form data");
      await addDoc(collection(db, COLLECTIONS.RIDE_QUEUE), rideData);
      setToast({
        open: true,
        message: `✅ Ride ${formData.TripID} submitted successfully`,
        severity: "success",
      });
      setFormData(defaultValues);
      setTouched({});
      setSubmitAttempted(false);
      setConfirmOpen(false);
      await fetchRides();
    } catch (err) {
      logError(err, "RideEntryForm:submit");
      setToast({
        open: true,
        message: `❌ ${err?.message || JSON.stringify(err)}`,
        severity: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [formData, validateFields, toRideDoc, fetchRides]);

  const handleImportConfirm = useCallback(async () => {
    if (!uploadedRows.length) {
      setToast({ open: true, message: "⚠️ No rows to import", severity: "warning" });
      return;
    }
    setSubmitting(true);
    try {
      const { added, skipped } = await processRideRows(uploadedRows);
      setToast({
        open: true,
        message: `✅ CSV rides imported (${added} added${skipped ? `, ${skipped} skipped` : ""})`,
        severity: "success",
      });
      setUploadedRows([]);
      await fetchRides();
    } catch (err) {
      logError(err, "RideEntryForm:import");
      setToast({
        open: true,
        message: `❌ ${err?.message || JSON.stringify(err)}`,
        severity: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [uploadedRows, processRideRows, fetchRides]);

  const handleCsvAppend = useCallback(() => {
    setBuilderSubmitAttempted(true);
    if (!validateFields(csvBuilder, setBuilderErrors)) {
      setToast({
        open: true,
        message: "⚠️ Please correct CSV builder fields",
        severity: "error",
      });
      return;
    }
    setUploadedRows((prev) => [...prev, csvBuilder]);
    setCsvBuilder(defaultValues);
    setBuilderErrors({});
    setBuilderTouched({});
    setBuilderSubmitAttempted(false);
  }, [csvBuilder, validateFields]);

  const handleMultiSubmit = useCallback(async () => {
    if (!uploadedRows.length && !multiInput.trim()) {
      setToast({ open: true, message: "⚠️ No rides to submit", severity: "warning" });
      return;
    }
    const ridesToSubmit = [...uploadedRows];
    if (multiInput.trim()) {
      const parsed = Papa.parse(multiInput.trim(), { header: true, skipEmptyLines: true });
      const missing = expectedCsvCols.filter((c) => !parsed.meta.fields?.includes(c));
      if (missing.length) {
        setToast({
          open: true,
          message: `⚠️ Missing columns: ${missing.join(", ")}`,
          severity: "warning",
        });
      } else if (parsed.data?.length) {
        ridesToSubmit.push(...parsed.data);
      }
    }
    if (!ridesToSubmit.length) {
      setToast({ open: true, message: "⚠️ No valid rides found", severity: "warning" });
      return;
    }
    setSubmitting(true);
    try {
      const { added, skipped } = await processRideRows(ridesToSubmit);
      setToast({
        open: true,
        message: `✅ All rides submitted (${added} added${skipped ? `, ${skipped} skipped` : ""})`,
        severity: "success",
      });
      setUploadedRows([]);
      setMultiInput("");
      await fetchRides();
    } catch (err) {
      logError(err, "RideEntryForm:bulkSubmit");
      setToast({
        open: true,
        message: `❌ ${err?.message || JSON.stringify(err)}`,
        severity: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [uploadedRows, multiInput, processRideRows, fetchRides]);

  // ---------- Render ----------
return (
  <LocalizationProvider dateAdapter={AdapterDayjs}>
    <Box sx={{ maxWidth: 1180, mx: "auto", p: { xs: 2, sm: 3 } }}>
      <Paper
        elevation={3}
        sx={{
          p: { xs: 2, sm: 3 },
          mb: 4,
          bgcolor: (t) =>
            t.palette.mode === "dark" ? "background.paper" : "background.default",
          borderRadius: 3,
        }}
      >
        <Typography variant="h6" fontWeight={700} gutterBottom>
          🚐 Ride Entry
        </Typography>

        {/* Tabs */}
        <Tabs
          value={rideTab}
          onChange={(e, v) => setRideTab(v)}
          sx={{
            mb: 3,
            "& .MuiTab-root": { minWidth: 150, fontWeight: 600 },
          }}
        >
          <Tab label="SINGLE RIDE" />
          <Tab label="MULTI RIDE UPLOAD" />
        </Tabs>

        {/* -------------------- SINGLE RIDE TAB -------------------- */}
        {rideTab === 0 && (
          <Fade in>
            <Box component="form" noValidate autoComplete="off">
              <Grid
                container
                spacing={2}
                key={shakeKey}
                className={!isFormValid && submitAttempted ? "shake" : undefined}
                sx={{
                  "&.shake": { animation: "shake 0.25s linear 1" },
                  "@keyframes shake": {
                    "0%": { transform: "translateX(0)" },
                    "25%": { transform: "translateX(-4px)" },
                    "50%": { transform: "translateX(4px)" },
                    "75%": { transform: "translateX(-2px)" },
                    "100%": { transform: "translateX(0)" },
                  },
                }}
              >
                {/* Trip ID */}
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    name="TripID"
                    label="Trip ID *"
                    value={formData.TripID}
                    onChange={handleSingleChange}
                    onBlur={handleBlur}
                    fullWidth
                    size="small"
                    required
                    inputProps={{ maxLength: 7 }}
                    error={showErr("TripID")}
                    helperText={showErr("TripID") ? "Required or invalid" : " "}
                  />
                </Grid>

                {/* Date */}
                <Grid item xs={12} sm={6} md={4}>
                  <DatePicker
                    label="Date *"
                    value={formData.Date ? dayjs(formData.Date) : null}
                    onChange={(newVal) =>
                      handleSingleChange({
                        target: {
                          name: "Date",
                          value: newVal ? newVal.format("YYYY-MM-DD") : "",
                        },
                      })
                    }
                    minDate={dayjs().startOf("day")}
                    slots={{ openPickerIcon: CalendarMonthIcon }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: "small",
                        required: true,
                        onBlur: handleBlur,
                        name: "Date",
                        error: showErr("Date"),
                        helperText: showErr("Date") ? "Required or invalid" : " ",
                      },
                    }}
                  />
                </Grid>

                {/* Pickup Time */}
                <Grid item xs={12} sm={6} md={4}>
                  <TimePicker
                    label="Pickup Time *"
                    value={
                      formData.PickupTime
                        ? dayjs(`2000-01-01T${formData.PickupTime}`)
                        : null
                    }
                    onChange={(newVal) =>
                      handleSingleChange({
                        target: {
                          name: "PickupTime",
                          value: newVal ? newVal.format("HH:mm") : "",
                        },
                      })
                    }
                    slots={{ openPickerIcon: AccessTimeIcon }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: "small",
                        required: true,
                        onBlur: handleBlur,
                        name: "PickupTime",
                        error: showErr("PickupTime"),
                        helperText: showErr("PickupTime") ? "Required or invalid" : " ",
                      },
                    }}
                  />
                </Grid>

                {/* Duration */}
                <Grid item xs={6} sm={3} md={2.5}>
                  <TextField
                    name="DurationHours"
                    label="Hours *"
                    type="number"
                    size="small"
                    value={formData.DurationHours}
                    onChange={handleSingleChange}
                    onBlur={handleBlur}
                    inputProps={{ min: 0, max: 24 }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">h</InputAdornment>,
                    }}
                    required
                    fullWidth
                    error={showErr("DurationHours")}
                    helperText={showErr("DurationHours") ? "Invalid" : " "}
                  />
                </Grid>

                <Grid item xs={6} sm={3} md={2.5}>
                  <TextField
                    name="DurationMinutes"
                    label="Minutes *"
                    type="number"
                    size="small"
                    value={formData.DurationMinutes}
                    onChange={handleSingleChange}
                    onBlur={handleBlur}
                    inputProps={{ min: 0, max: 59 }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">m</InputAdornment>,
                    }}
                    required
                    fullWidth
                    error={showErr("DurationMinutes")}
                    helperText={showErr("DurationMinutes") ? "Invalid" : " "}
                  />
                </Grid>

                {/* Ride Type */}
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    select
                    name="RideType"
                    label="Ride Type *"
                    size="small"
                    value={formData.RideType}
                    onChange={handleSingleChange}
                    onBlur={handleBlur}
                    fullWidth
                    required
                    error={showErr("RideType")}
                    helperText={showErr("RideType") ? "Required" : " "}
                  >
                    {rideTypeOptions.map((opt) => (
                      <MenuItem key={opt} value={opt}>
                        {opt}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                {/* Vehicle */}
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    select
                    name="Vehicle"
                    label="Vehicle *"
                    size="small"
                    value={formData.Vehicle}
                    onChange={handleSingleChange}
                    onBlur={handleBlur}
                    fullWidth
                    required
                    error={showErr("Vehicle")}
                    helperText={showErr("Vehicle") ? "Required" : " "}
                  >
                    {vehicleOptions.map((opt) => (
                      <MenuItem key={opt} value={opt}>
                        {opt}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                {/* Ride Notes */}
                <Grid item xs={12} md={6}>
                  <TextField
                    name="RideNotes"
                    label="Ride Notes"
                    value={formData.RideNotes}
                    onChange={handleSingleChange}
                    onBlur={handleBlur}
                    fullWidth
                    size="small"
                    multiline
                    minRows={2}
                  />
                </Grid>

                {/* Buttons */}
                <Grid item xs={12}>
                  <Box display="flex" justifyContent="flex-end" gap={2}>
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => {
                        setFormData(defaultValues);
                        setTouched({});
                        setSubmitAttempted(false);
                        errorFields.current = {};
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      disabled={submitting || !isFormValid}
                      onClick={() => setConfirmOpen(true)}
                    >
                      Submit
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Fade>
        )}
        {/* -------------------- MULTI RIDE UPLOAD TAB -------------------- */}
        {rideTab === 1 && (
          <Fade in>
            <Box>
              <Grid container spacing={3}>
                {/* Template download + Dropzone */}
                <Grid item xs={12} md={3}>
                  <Stack spacing={2}>
                    <Button
                      aria-label="Download ride template CSV"
                      href="/ride-template.csv"
                      download
                      fullWidth
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                    >
                      Download Template
                    </Button>

                    <Box
                      {...getRootProps()}
                      sx={{
                        border: "2px dashed",
                        borderRadius: 2,
                        borderColor: isDragActive ? "success.main" : "divider",
                        bgcolor: "background.default",
                        color: "text.secondary",
                        textAlign: "center",
                        px: 2,
                        py: 3,
                        cursor: "pointer",
                        height: 168,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <input {...getInputProps()} />
                      <Box>
                        <UploadFileIcon sx={{ fontSize: 36, mb: 0.5 }} />
                        <Typography variant="body2">
                          {isDragActive
                            ? "Drop file here"
                            : "Drag & drop CSV/XLS here or click to select"}
                        </Typography>
                      </Box>
                    </Box>

                    {fileError && (
                      <Typography variant="caption" color="error">
                        {fileError}
                      </Typography>
                    )}
                  </Stack>
                </Grid>

                {/* Instruction box */}
                <Grid item xs={12} md={6}>
                  <Box
                    sx={{
                      border: "2px dashed",
                      borderColor: "divider",
                      borderRadius: 2,
                      minHeight: 168,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      p: 3,
                      color: "text.secondary",
                    }}
                  >
                    <Typography variant="body2">
                      Rides added using the form below will appear in a preview.
                      You can also paste CSV text or upload a file.
                    </Typography>
                  </Box>
                </Grid>

                {/* CSV paste box */}
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Paste CSV Rides"
                    fullWidth
                    multiline
                    minRows={6}
                    value={multiInput}
                    onChange={(e) => setMultiInput(e.target.value)}
                    sx={{ height: "100%" }}
                  />
                </Grid>
              </Grid>

              {/* CSV Builder */}
              <Box mt={4}>
                <Typography variant="subtitle1" fontWeight={600} mb={1}>
                  Or Use Ride Builder
                </Typography>
                <Grid container spacing={2}>
                  {/* TripID */}
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      name="TripID"
                      label="Trip ID *"
                      value={csvBuilder.TripID}
                      onChange={(e) => handleChange(e, setCsvBuilder, setBuilderErrors)}
                      onBlur={handleBuilderBlur}
                      fullWidth
                      size="small"
                      error={!!builderErrors.TripID && (builderTouched.TripID || builderSubmitAttempted)}
                      helperText={
                        !!builderErrors.TripID && (builderTouched.TripID || builderSubmitAttempted)
                          ? "Required or invalid"
                          : " "
                      }
                    />
                  </Grid>

                  {/* Date */}
                  <Grid item xs={12} sm={6} md={3}>
                    <DatePicker
                      label="Date *"
                      value={csvBuilder.Date ? dayjs(csvBuilder.Date) : null}
                      onChange={(newVal) =>
                        handleChange(
                          {
                            target: {
                              name: "Date",
                              value: newVal ? newVal.format("YYYY-MM-DD") : "",
                            },
                          },
                          setCsvBuilder,
                          setBuilderErrors
                        )
                      }
                      minDate={dayjs().startOf("day")}
                      slots={{ openPickerIcon: CalendarMonthIcon }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: "small",
                          name: "Date",
                          required: true,
                          onBlur: handleBuilderBlur,
                          error: !!builderErrors.Date && (builderTouched.Date || builderSubmitAttempted),
                          helperText:
                            !!builderErrors.Date && (builderTouched.Date || builderSubmitAttempted)
                              ? "Required or invalid"
                              : " ",
                        },
                      }}
                    />
                  </Grid>

                  {/* Pickup Time */}
                  <Grid item xs={12} sm={6} md={3}>
                    <TimePicker
                      label="Pickup Time *"
                      value={
                        csvBuilder.PickupTime
                          ? dayjs(`2000-01-01T${csvBuilder.PickupTime}`)
                          : null
                      }
                      onChange={(newVal) =>
                        handleChange(
                          {
                            target: {
                              name: "PickupTime",
                              value: newVal ? newVal.format("HH:mm") : "",
                            },
                          },
                          setCsvBuilder,
                          setBuilderErrors
                        )
                      }
                      slots={{ openPickerIcon: AccessTimeIcon }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: "small",
                          name: "PickupTime",
                          required: true,
                          onBlur: handleBuilderBlur,
                          error:
                            !!builderErrors.PickupTime &&
                            (builderTouched.PickupTime || builderSubmitAttempted),
                          helperText:
                            !!builderErrors.PickupTime &&
                            (builderTouched.PickupTime || builderSubmitAttempted)
                              ? "Required or invalid"
                              : " ",
                        },
                      }}
                    />
                  </Grid>
                  {/* Duration */}
                  <Grid item xs={6} sm={3} md={2}>
                    <TextField
                      name="DurationHours"
                      label="Hours *"
                      type="number"
                      size="small"
                      value={csvBuilder.DurationHours}
                      onChange={(e) => handleChange(e, setCsvBuilder, setBuilderErrors)}
                      onBlur={handleBuilderBlur}
                      inputProps={{ min: 0, max: 24 }}
                      InputProps={{ endAdornment: <InputAdornment position="end">h</InputAdornment> }}
                      required
                      fullWidth
                      error={
                        !!builderErrors.DurationHours &&
                        (builderTouched.DurationHours || builderSubmitAttempted)
                      }
                      helperText={
                        !!builderErrors.DurationHours &&
                        (builderTouched.DurationHours || builderSubmitAttempted)
                          ? "Invalid"
                          : " "
                      }
                    />
                  </Grid>

                  <Grid item xs={6} sm={3} md={2}>
                    <TextField
                      name="DurationMinutes"
                      label="Minutes *"
                      type="number"
                      size="small"
                      value={csvBuilder.DurationMinutes}
                      onChange={(e) => handleChange(e, setCsvBuilder, setBuilderErrors)}
                      onBlur={handleBuilderBlur}
                      inputProps={{ min: 0, max: 59 }}
                      InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }}
                      required
                      fullWidth
                      error={
                        !!builderErrors.DurationMinutes &&
                        (builderTouched.DurationMinutes || builderSubmitAttempted)
                      }
                      helperText={
                        !!builderErrors.DurationMinutes &&
                        (builderTouched.DurationMinutes || builderSubmitAttempted)
                          ? "Invalid"
                          : " "
                      }
                    />
                  </Grid>

                  {/* Ride Type */}
                  <Grid item xs={6} sm={3} md={2.5}>
                    <TextField
                      select
                      name="RideType"
                      label="Ride Type *"
                      size="small"
                      value={csvBuilder.RideType}
                      onChange={(e) => handleChange(e, setCsvBuilder, setBuilderErrors)}
                      onBlur={handleBuilderBlur}
                      required
                      fullWidth
                      error={
                        !!builderErrors.RideType &&
                        (builderTouched.RideType || builderSubmitAttempted)
                      }
                      helperText={
                        !!builderErrors.RideType &&
                        (builderTouched.RideType || builderSubmitAttempted)
                          ? "Required"
                          : " "
                      }
                    >
                      {rideTypeOptions.map((opt) => (
                        <MenuItem key={opt} value={opt}>
                          {opt}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  {/* Vehicle */}
                  <Grid item xs={6} sm={3} md={2.5}>
                    <TextField
                      select
                      name="Vehicle"
                      label="Vehicle *"
                      size="small"
                      value={csvBuilder.Vehicle}
                      onChange={(e) => handleChange(e, setCsvBuilder, setBuilderErrors)}
                      onBlur={handleBuilderBlur}
                      required
                      fullWidth
                      error={
                        !!builderErrors.Vehicle &&
                        (builderTouched.Vehicle || builderSubmitAttempted)
                      }
                      helperText={
                        !!builderErrors.Vehicle &&
                        (builderTouched.Vehicle || builderSubmitAttempted)
                          ? "Required"
                          : " "
                      }
                    >
                      {vehicleOptions.map((opt) => (
                        <MenuItem key={opt} value={opt}>
                          {opt}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  {/* Notes */}
                  <Grid item xs={12} md={6}>
                    <TextField
                      name="RideNotes"
                      label="Ride Notes"
                      value={csvBuilder.RideNotes}
                      onChange={(e) => handleChange(e, setCsvBuilder, setBuilderErrors)}
                      onBlur={handleBuilderBlur}
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                    />
                  </Grid>

                  {/* Actions */}
                  <Grid item xs={12}>
                    <Box display="flex" gap={2} flexWrap="wrap">
                      <Button
                        variant="contained"
                        onClick={handleCsvAppend}
                        sx={{ fontWeight: 600 }}
                      >
                        ➕ Add to List
                      </Button>
                      <Button
                        variant="contained"
                        color="success"
                        onClick={handleMultiSubmit}
                        disabled={submitting}
                        sx={{ fontWeight: 600 }}
                        startIcon={
                          submitting ? <CircularProgress size={18} color="inherit" /> : null
                        }
                      >
                        {submitting ? "Submitting…" : "🚀 Submit All Rides"}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Preview Table */}
              {uploadedRows.length > 0 && (
                <Box mt={4}>
                  <Typography variant="subtitle1" fontWeight={600} mb={1}>
                    Preview Rides ({uploadedRows.length})
                  </Typography>
                  <DataGrid
                    autoHeight
                    density="compact"
                    rows={uploadedRows.map((r, i) => ({ id: i, ...r }))}
                    columns={[
                      { field: "TripID", headerName: "Trip ID", flex: 1 },
                      { field: "Date", headerName: "Date", flex: 1 },
                      { field: "PickupTime", headerName: "Time", flex: 1 },
                      { field: "DurationHours", headerName: "Hr", flex: 0.5 },
                      { field: "DurationMinutes", headerName: "Min", flex: 0.5 },
                      { field: "RideType", headerName: "Type", flex: 1 },
                      { field: "Vehicle", headerName: "Vehicle", flex: 1 },
                    ]}
                    pageSizeOptions={[5]}
                  />
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
                  >
                    Import Rides
                  </Button>
                </Box>
              )}
            </Box>
          </Fade>
        )}

      </Paper>

      {/* Daily Rides Update Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            <SyncIcon fontSize="small" sx={{ mr: 1 }} />
            Synced: {syncTime}
          </Typography>
          <Tooltip title="Runs Firebase function to refresh daily rides">
            <span>
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                variant="outlined"
                color="secondary"
                startIcon={
                  <SyncIcon
                    sx={{
                      animation: refreshing ? "spin 1s linear infinite" : "none",
                    }}
                  />
                }
              >
                Update Daily Rides
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Paper>

      {/* Live / Queue / Claimed Tabs */}
      <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
        <Tabs
          value={dataTab}
          onChange={(e, val) => setDataTab(val)}
          TabIndicatorProps={{ style: { backgroundColor: "#00c853" } }}
          sx={{ flexGrow: 1, "& .MuiTab-root": { minWidth: 120 } }}
        >
          <Tab
            label={
              <Box display="flex" alignItems="center" gap={0.5}>
                <Typography fontWeight={600} color={dataTab === 0 ? "success.main" : "inherit"}>
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
                <Typography fontWeight={600} color={dataTab === 1 ? "success.main" : "inherit"}>
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
                <Typography fontWeight={600} color={dataTab === 2 ? "success.main" : "inherit"}>
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

      <Box sx={{ width: "100%", overflowX: "hidden" }}>
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
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Ride</DialogTitle>
        <DialogContent dividers>
          {Object.entries(preview).map(([key, value]) => (
            <Typography key={key} sx={{ mb: 0.5 }}>
              <strong>{key.replace(/([A-Z])/g, " $1")}:</strong> {value || "—"}
            </Typography>
          ))}
          <Box display="flex" justifyContent="flex-end" gap={2} mt={2}>
            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleSubmit}
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              Confirm & Submit
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ ...toast, open: false })}
      >
        <Alert severity={toast.severity} variant="filled">
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  </LocalizationProvider>
);
}
