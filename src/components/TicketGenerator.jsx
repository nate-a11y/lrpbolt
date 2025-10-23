/* Proprietary and confidential. See LICENSE. */
// src/components/TicketGenerator.jsx
import { useState, useRef, useCallback } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Divider,
  Modal,
  Snackbar,
  Alert,
  Stack,
  Autocomplete,
  useTheme,
} from "@mui/material";
import QRCode from "react-qr-code";
import { toPng } from "html-to-image";
import { v4 as uuidv4 } from "uuid";
import { Timestamp } from "firebase/firestore";

import { dayjs, formatDate, formatDateTime } from "@/utils/time";

import {
  addTicket as apiAddTicket,
  emailTicket as apiEmailTicket,
} from "../hooks/api";
import logError from "../utils/logError.js";

import PageContainer from "./PageContainer.jsx";

const getStoredLocations = (key) =>
  JSON.parse(localStorage.getItem(key) || "[]");
const storeLocation = (key, value) => {
  const stored = new Set(getStoredLocations(key));
  stored.add(value);
  localStorage.setItem(key, JSON.stringify([...stored].slice(-5)));
};

export default function TicketGenerator() {
  const [formData, setFormData] = useState({
    passenger: "",
    date: "",
    time: "",
    pickup: "",
    dropoff: "",
    passengerCount: "",
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openPreview, setOpenPreview] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const ticketRef = useRef(null);
  const [emailSending, setEmailSending] = useState(false);
  const pickupOptions = getStoredLocations("lrp_pickup");
  const dropoffOptions = getStoredLocations("lrp_dropoff");
  const theme = useTheme();

  const validate = () => {
    const newErrors = {};
    if (!formData.passenger.trim())
      newErrors.passenger = "Passenger name is required";
    if (!formData.date) newErrors.date = "Pick-up date is required";
    if (!formData.time) newErrors.time = "Pick-up time is required";
    if (
      formData.date === dayjs().format("YYYY-MM-DD") &&
      dayjs(formData.time, "HH:mm").isBefore(dayjs())
    ) {
      newErrors.time = "Time appears to be in the past";
    }
    if (!formData.pickup.trim())
      newErrors.pickup = "Pickup location is required";
    if (!formData.dropoff.trim())
      newErrors.dropoff = "Dropoff location is required";
    const count = parseInt(formData.passengerCount, 10);
    if (!formData.passengerCount) {
      newErrors.passengerCount = "Passenger count is required";
    } else if (isNaN(count) || count < 1 || count > 37) {
      newErrors.passengerCount = "Must be a number between 1 and 37";
    }
    if (formData.notes.length > 300) {
      newErrors.notes = "Notes too long";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field) => (e, val) => {
    const value = typeof e === "string" ? e : (e.target?.value ?? val ?? "");
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!validate() || loading) return;
    setLoading(true);

    const id = uuidv4().split("-")[0];
    const ticketId = `TICKET-${id.toUpperCase()}`;

    // ✅ Combine date & time into a Firestore Timestamp
    const pickupTimestamp = Timestamp.fromDate(
      dayjs(`${formData.date} ${formData.time}`, "YYYY-MM-DD HH:mm").toDate(),
    );

    const newTicket = {
      ticketId,
      passenger: formData.passenger.trim(),
      pickup: formData.pickup.trim(),
      dropoff: formData.dropoff.trim(),
      pickupTime: pickupTimestamp,
      passengercount: Number(formData.passengerCount),
      notes: formData.notes.trim() || null,
      scannedOutbound: false,
      scannedReturn: false,
      createdAt: Timestamp.now(),
    };

    try {
      await apiAddTicket(newTicket);
      setTicket({
        ...newTicket,
        passengerCount: Number(formData.passengerCount),
      });
      setFormData({
        passenger: "",
        date: "",
        time: "",
        pickup: "",
        dropoff: "",
        passengerCount: "",
        notes: "",
      });
      storeLocation("lrp_pickup", newTicket.pickup);
      storeLocation("lrp_dropoff", newTicket.dropoff);
      setOpenPreview(true);
    } catch (err) {
      logError(err, { where: "TicketGenerator:save" });
      setSnackbar({
        open: true,
        message: "🚨 Error saving ticket to Firestore",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const backgroundPaper = theme.palette.background.paper;

  const ensureTicketImage = useCallback(async () => {
    if (!ticketRef.current || !ticket) {
      throw new Error("Ticket preview unavailable");
    }

    const raf =
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame
        : (cb) => setTimeout(cb, 16);

    await new Promise((resolve) => raf(() => raf(resolve)));

    return toPng(ticketRef.current, {
      backgroundColor: backgroundPaper,
      pixelRatio: 2,
      cacheBust: true,
    });
  }, [backgroundPaper, ticket]);

  const downloadTicket = async () => {
    try {
      const dataUrl = await ensureTicketImage();
      const link = document.createElement("a");
      link.download = `${ticket.ticketId}.png`;
      link.href = dataUrl;
      link.click();
      setSnackbar({
        open: true,
        message: "📸 Ticket saved as image",
        severity: "success",
      });
    } catch (err) {
      logError(err, { where: "TicketGenerator:download" });
      setSnackbar({
        open: true,
        message: "❌ Failed to generate image",
        severity: "error",
      });
    }
  };

  const emailTicket = async () => {
    if (!emailAddress) return;
    setEmailSending(true);
    let succeeded = false;
    try {
      const dataUrl = await ensureTicketImage();
      const base64 = dataUrl.split(",")[1];

      const result = await apiEmailTicket(
        ticket.ticketId,
        emailAddress,
        base64,
      );
      if (result.success) {
        setSnackbar({
          open: true,
          message: "📧 Ticket emailed",
          severity: "success",
        });
        succeeded = true;
      } else throw new Error("Failed");
    } catch (err) {
      logError(err, { where: "TicketGenerator:email" });
      setSnackbar({
        open: true,
        message: "❌ Email failed",
        severity: "error",
      });
    } finally {
      setEmailSending(false);
      if (succeeded) {
        setEmailDialogOpen(false);
        setEmailAddress("");
      }
    }
  };

  const handlePrint = () => {
    const contents = ticketRef.current.innerHTML;
    const win = window.open("", "Print", "height=600,width=400");
    if (!win) return;
    win.document.write(
      `<html><head><title>Ticket</title><style>body{background:${theme.palette.background.paper};color:${theme.palette.text.primary};padding:20px;font-family:sans-serif;} img{display:block;margin:auto;}</style></head><body>`,
    );
    win.document.write(contents);
    win.document.write("</body></html>");
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const handleClosePreview = () => {
    setOpenPreview(false);
    setTicket(null);
  };
  const rawPickupTime =
    ticket?.pickupTime ?? ticket?.pickupAt ?? ticket?.pickupTimestamp ?? null;
  const computedPickupDate = rawPickupTime
    ? formatDate(rawPickupTime)
    : "N/A";
  const computedPickupTime = rawPickupTime
    ? formatDateTime(rawPickupTime, "h:mm A z")
    : "N/A";
  const pickupDateLabel =
    computedPickupDate && computedPickupDate !== "N/A"
      ? computedPickupDate
      : ticket?.date || "N/A";
  const pickupTimeLabel =
    computedPickupTime && computedPickupTime !== "N/A"
      ? computedPickupTime
      : ticket?.time
        ? `${ticket.time}`
        : "N/A";
  const passengerCountLabel =
    ticket?.passengerCount ?? ticket?.passengercount ?? "N/A";

  return (
    <PageContainer maxWidth={500}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        🚌 Generate Shuttle Ticket
      </Typography>

      <form onSubmit={handleGenerate}>
        <Paper sx={{ p: 3, mb: 3 }} elevation={4}>
          <TextField
            fullWidth
            label="Passenger Name"
            sx={{ mb: 2 }}
            autoFocus
            value={formData.passenger}
            onChange={handleChange("passenger")}
            error={!!errors.passenger}
            helperText={errors.passenger}
          />
          <TextField
            fullWidth
            type="date"
            label="Pick-up Date"
            sx={{ mb: 2 }}
            value={formData.date}
            onChange={handleChange("date")}
            error={!!errors.date}
            helperText={errors.date}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            type="time"
            label="Pick-up Time"
            sx={{ mb: 2 }}
            value={formData.time}
            onChange={handleChange("time")}
            error={!!errors.time}
            helperText={errors.time}
            InputLabelProps={{ shrink: true }}
          />
          <Autocomplete
            freeSolo
            options={pickupOptions}
            inputValue={formData.pickup}
            onInputChange={(_, value) => handleChange("pickup")(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Pickup Location"
                sx={{ mb: 2 }}
                error={!!errors.pickup}
                helperText={errors.pickup}
              />
            )}
          />
          <Autocomplete
            freeSolo
            options={dropoffOptions}
            inputValue={formData.dropoff}
            onInputChange={(_, value) => handleChange("dropoff")(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Dropoff Location"
                sx={{ mb: 2 }}
                error={!!errors.dropoff}
                helperText={errors.dropoff}
              />
            )}
          />
          <TextField
            fullWidth
            type="number"
            label="Passenger Count"
            inputProps={{ min: 1, max: 37 }}
            sx={{ mb: 2 }}
            value={formData.passengerCount}
            onChange={handleChange("passengerCount")}
            error={!!errors.passengerCount}
            helperText={errors.passengerCount}
          />
          <TextField
            fullWidth
            label="Notes"
            sx={{ mb: 2 }}
            multiline
            maxRows={4}
            value={formData.notes}
            onChange={handleChange("notes")}
            error={!!errors.notes}
            helperText={errors.notes}
          />
          <Button
            variant="contained"
            type="submit"
            fullWidth
            disabled={loading}
          >
            {loading ? "Generating…" : "Generate Ticket"}
          </Button>
        </Paper>
      </form>

      <Modal open={openPreview} onClose={handleClosePreview}>
        <Box
          sx={{
            bgcolor: "background.paper",
            borderRadius: 2,
            p: { xs: 3, sm: 4 },
            width: { xs: "calc(100vw - 32px)", sm: 360 },
            mx: "auto",
            mt: { xs: 4, sm: "10vh" },
            boxShadow: 24,
            outline: "none",
            maxHeight: "90vh",
            overflowY: "auto",
          }}
        >
          {ticket ? (
            <>
              <Box
                ref={ticketRef}
                sx={{
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  p: 3,
                  borderRadius: 2,
                  width: "100%",
                  maxWidth: 320,
                  mx: "auto",
                }}
              >
                <Box display="flex" justifyContent="center" mb={2}>
                  <Box
                    component="img"
                    src="/android-chrome-512x512.png"
                    alt="Lake Ride Pros"
                    sx={{ height: 48, objectFit: "contain" }}
                  />
                </Box>
                <Typography variant="h6" fontWeight="bold" align="center">
                  🎟️ Shuttle Ticket
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Typography>
                  <strong>Passenger:</strong> {ticket.passenger}
                </Typography>
                <Typography>
                  <strong>Passenger Count:</strong> {passengerCountLabel}
                </Typography>
                <Typography>
                  <strong>Date:</strong> {pickupDateLabel}
                </Typography>
                <Typography>
                  <strong>Time:</strong> {pickupTimeLabel}
                </Typography>
                <Typography>
                  <strong>Pickup:</strong> {ticket.pickup}
                </Typography>
                <Typography>
                  <strong>Dropoff:</strong> {ticket.dropoff}
                </Typography>
                {ticket.notes && (
                  <Typography>
                    <strong>Notes:</strong> {ticket.notes}
                  </Typography>
                )}
                <Typography sx={{ mt: 1 }}>
                  <strong>Ticket ID:</strong> {ticket.ticketId}
                </Typography>
                <Box mt={3} display="flex" justifyContent="center">
                  <Box sx={{ p: 2, bgcolor: theme.palette.background.paper }}>
                    <QRCode
                      value={`https://lakeridepros.xyz/ticket/${ticket.ticketId}`}
                      size={160}
                    />
                  </Box>
                </Box>
              </Box>
              <Stack
                spacing={1}
                direction={{ xs: "column", sm: "row" }}
                mt={3}
                sx={{ width: "100%" }}
              >
                <Button variant="outlined" onClick={handlePrint}>
                  Print
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  onClick={downloadTicket}
                >
                  Download
                </Button>
                <Button
                  variant="outlined"
                  color="info"
                  onClick={() => setEmailDialogOpen(true)}
                >
                  Email
                </Button>
                <Button variant="text" onClick={handleClosePreview}>
                  Close
                </Button>
              </Stack>
            </>
          ) : (
            <Typography align="center">Loading ticket preview…</Typography>
          )}
        </Box>
      </Modal>

      <Modal open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)}>
        <Box
          sx={{
            backgroundColor: "background.paper",
            p: 3,
            borderRadius: 2,
            width: 300,
            mx: "auto",
            mt: "20vh",
            boxShadow: 24,
          }}
        >
          <Typography variant="h6" gutterBottom>
            Email Ticket
          </Typography>
          <TextField
            fullWidth
            label="Email Address"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            type="email"
            autoFocus
            disabled={emailSending}
            sx={{ mb: 2 }}
          />
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              onClick={() => setEmailDialogOpen(false)}
              disabled={emailSending}
            >
              Cancel
            </Button>
            <Button
              onClick={emailTicket}
              variant="contained"
              color="primary"
              disabled={!emailAddress || emailSending}
            >
              {emailSending ? "Sending…" : "Send"}
            </Button>
          </Stack>
        </Box>
      </Modal>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
}
