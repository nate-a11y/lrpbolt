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
  Stack,
  DialogContent,
  CircularProgress,
  Badge,
  Grid,
  Tooltip,
  useMediaQuery,
  IconButton,
  Fade,
  InputAdornment,
} from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import DownloadIcon from "@mui/icons-material/Download";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import AddIcon from "@mui/icons-material/Add";
import ReplayIcon from "@mui/icons-material/Replay"; // ← Add this
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
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
import { dropDailyRidesNow } from "../services/api";
import Papa from "papaparse";
import {
  LocalizationProvider,
  DatePicker,
  TimePicker,
} from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DataGrid } from "@mui/x-data-grid";
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
      console.log("[UI] Refreshing rides via Cloud Function…");
      const data = await dropDailyRidesNow({ refresh: true });
      console.log("[UI] Refresh result:", data);
      const msg =
        data && typeof data.imported === "number"
          ? `✅ Daily drop executed — added ${data.imported} ride(s)`
          : "✅ Daily drop executed";
      setToast({ open: true, message: msg, severity: "success" });
      await fetchRides();
    } catch (error) {
      console.error("[UI] Refresh failed:", error);
      logError(error, "RideEntryForm:refresh");
      setToast({
        open: true,
        message: `❌ Refresh failed: ${error?.message || JSON.stringify(error)}`,
        severity: "error",
      });
    } finally {
      setRefreshing(false);
    }
  }, [fetchRides]);

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

  const handleDownloadTemplate = () => {
    const sample = {
      TripID: "ABCD-12",
      Date: dayjs().add(1, "day").format("YYYY-MM-DD"),
      PickupTime: "08:00",
      DurationHours: "1",
      DurationMinutes: "30",
      RideType: rideTypeOptions[0],
      Vehicle: vehicleOptions[0],
      RideNotes: "Sample notes",
    };
    const header = expectedCsvCols.join(",");
    const row = expectedCsvCols.map(col => sample[col]).join(",");
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

        {/* SINGLE RIDE TAB */}
        {rideTab === 0 && (
          <Box sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Trip ID **"
                  name="TripID"
                  value={formData.TripID}
                  onChange={handleSingleChange}
                  onBlur={handleBlur}
                  error={showErr("TripID")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <DatePicker
                  label="Date **"
                  value={formData.Date ? dayjs(formData.Date) : null}
                  onChange={(val) =>
                    setFormData((fd) => ({
                      ...fd,
                      Date: val ? dayjs(val).format("YYYY-MM-DD") : "",
                    }))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      name="Date"
                      onBlur={handleBlur}
                      error={showErr("Date")}
                      fullWidth
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TimePicker
                  label="Pickup Time **"
                  value={
                    formData.PickupTime
                      ? dayjs(formData.PickupTime, "HH:mm")
                      : null
                  }
                  onChange={(val) =>
                    setFormData((fd) => ({
                      ...fd,
                      PickupTime: val ? dayjs(val).format("HH:mm") : "",
                    }))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      name="PickupTime"
                      onBlur={handleBlur}
                      error={showErr("PickupTime")}
                      fullWidth
                    />
                  )}
                />
              </Grid>
              <Grid item xs={6} md={1.5}>
                <TextField
                  label="Hours **"
                  name="DurationHours"
                  value={formData.DurationHours}
                  onChange={handleSingleChange}
                  onBlur={handleBlur}
                  error={showErr("DurationHours")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6} md={1.5}>
                <TextField
                  label="Minutes **"
                  name="DurationMinutes"
                  value={formData.DurationMinutes}
                  onChange={handleSingleChange}
                  onBlur={handleBlur}
                  error={showErr("DurationMinutes")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={0.5}>
                <IconButton onClick={() => setFormData(fd => ({ ...fd, DurationHours: "", DurationMinutes: "" }))} edge="end">
                  <ReplayIcon />
                </IconButton>
              </Grid>
              <Grid item xs={12} md={9}>
                <TextField
                  label="Ride Notes"
                  name="RideNotes"
                  value={formData.RideNotes}
                  onChange={handleSingleChange}
                  fullWidth
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} md={3} container spacing={1} justifyContent="flex-end">
                <Grid item>
                  <Button
                    onClick={() => setFormData(defaultValues)}
                    variant="outlined"
                    color="secondary"
                  >
                    RESET
                  </Button>
                </Grid>
                <Grid item>
                  <Button
                    onClick={() => setConfirmOpen(true)}
                    variant="contained"
                    disabled={submitting || !isFormValid}
                  >
                    {submitting ? <CircularProgress size={20} /> : "SUBMIT"}
                  </Button>
                </Grid>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* MULTI RIDE UPLOAD TAB */}
        {rideTab === 1 && (
          <Box sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadTemplate}
                >
                  Download Template
                </Button>
              </Grid>
              <Grid item xs={12} md={8}>
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
                    Drag & drop CSV/XLS here or click to select
                  </Typography>
                  {fileError && (
                    <Typography color="error" variant="caption">
                      {fileError}
                    </Typography>
                  )}
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Paste CSV Rides"
                  multiline
                  minRows={4}
                  maxRows={10}
                  value={multiInput}
                  onChange={(e) => setMultiInput(e.target.value)}
                  fullWidth
                />
              </Grid>
              {/* CSV Builder fields */}
              <Grid item xs={12} md={6}>
                <Grid container spacing={2}>
                  {expectedCsvCols
                    .filter(f => f !== "RideNotes") // RideNotes last
                    .map(field => (
                      <Grid item xs={12} sm={6} key={field}>
                        <TextField
                          label={field.replace(/([A-Z])/g, " $1")}
                          name={field}
                          value={csvBuilder[field]}
                          onChange={e => setCsvBuilder(b => ({ ...b, [field]: e.target.value }))}
                          onBlur={handleBuilderBlur}
                          error={!!builderErrors[field] && (builderTouched[field] || builderSubmitAttempted)}
                          fullWidth
                        />
                      </Grid>
                    ))}
                  <Grid item xs={12}>
                    <TextField
                      label="Ride Notes"
                      name="RideNotes"
                      value={csvBuilder.RideNotes}
                      onChange={e => setCsvBuilder(b => ({ ...b, RideNotes: e.target.value }))}
                      multiline
                      rows={2}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} container spacing={1} justifyContent="flex-end">
                    <Grid item>
                      <Button
                        onClick={handleCsvAppend}
                        variant="contained"
                        color="success"
                        startIcon={<AddIcon />}
                      >
                        Add to List
                      </Button>
                    </Grid>
                    <Grid item>
                      <Button
                        onClick={handleMultiSubmit}
                        variant="contained"
                        color="success"
                        startIcon={<RocketLaunchIcon />}
                        disabled={submitting}
                      >
                        Submit All Rides
                      </Button>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
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
                  columns={expectedCsvCols.map(col => ({
                    field: col,
                    headerName: col.replace(/([A-Z])/g, " $1"),
                    flex: 1,
                  }))}
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
        )}
      </Paper>

      {/* Daily Rides Update Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center" }}>
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
