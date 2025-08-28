/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Stack,
  Typography,
  Paper,
  Divider,
  Button,
  Alert,
  Snackbar,
} from "@mui/material";
import { dayjs, toDayjs, formatDateTime } from "@/utils/time";

import { fetchTicket, updateTicketScan } from "../hooks/api";
import useAuth from "../hooks/useAuth.js";
import logError from "../utils/logError.js";

export default function TicketViewer() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchTicket(ticketId)
      .then((data) => {
        if (data.error) {
          setError(true);
          setTicket(null);
        } else {
          setTicket(data);
          setError(false);
        }
      })
      .catch((err) => {
        logError(err, "TicketViewer:fetch");
        setError(true);
        setTicket(null);
      })
      .finally(() => setLoading(false));
  }, [ticketId]);

  const updateScanStatus = (field) => {
    if (!ticket || ticket[field]) return;

    const driver = user?.email || "Unknown";
    updateTicketScan(
      ticketId,
      field === "scannedOutbound" ? "outbound" : "return",
      driver,
    )
      .then((result) => {
        if (result.success) {
          setTicket((prev) => ({ ...prev, [field]: true }));
          setSnackbar({
            open: true,
            message: "✅ Ticket updated successfully!",
            severity: "success",
          });
        } else {
          setSnackbar({
            open: true,
            message: "❌ Failed to update scan status",
            severity: "error",
          });
        }
      })
      .catch((err) => {
        logError(err, "TicketViewer:updateScan");
        setSnackbar({
          open: true,
          message: "🚨 Error updating scan status",
          severity: "error",
        });
      });
  };

  if (loading) {
    return (
      <Box sx={{ mt: 4, textAlign: "center" }}>
        <Typography>Loading ticket...</Typography>
      </Box>
    );
  }

  if (error || !ticket) {
    return (
      <Box sx={{ mt: 4, textAlign: "center" }}>
        <Typography variant="h6" color="error">
          Ticket not found. ❌
        </Typography>
        <Typography variant="body2">
          Make sure the ticket ID is valid.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
      <Paper sx={{ p: 3 }} elevation={4}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          🧾 Shuttle Ticket - {ticket.ticketId}
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Typography>
          <strong>Passenger:</strong> {ticket.passenger || "—"}
        </Typography>
        <Typography>
          <strong>Passenger Count:</strong> {ticket.passengercount || "—"}
        </Typography>
        <Typography>
          <strong>Date:</strong>{" "}
          {ticket.date ? dayjs(ticket.date).format("MMMM D, YYYY") : "—"}
        </Typography>
        <Typography>
          <strong>Time:</strong> {ticket.time || "—"}
        </Typography>
        <Typography>
          <strong>Pickup:</strong> {ticket.pickup || "—"}
        </Typography>
        <Typography>
          <strong>Dropoff:</strong> {ticket.dropoff || "—"}
        </Typography>
        {ticket.notes && (
          <Typography>
            <strong>Notes:</strong> {ticket.notes}
          </Typography>
        )}
        <Typography sx={{ mt: 1 }}>
          <strong>Created:</strong>{" "}
          {ticket.createdAt
            ? dayjs(ticket.createdAt).format("MMMM D, YYYY h:mm A")
            : "—"}
        </Typography>

        <Divider sx={{ my: 2 }} />
        <Typography
          color={ticket.scannedOutbound ? "success.main" : "text.secondary"}
        >
          ✅ Outbound: {ticket.scannedOutbound ? "Scanned" : "Not Scanned"}
        </Typography>
        <Typography
          color={ticket.scannedReturn ? "success.main" : "text.secondary"}
        >
          🔁 Return: {ticket.scannedReturn ? "Scanned" : "Not Scanned"}
        </Typography>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ mt: 2 }}
        >
          <Button
            variant="contained"
            color="success"
            disabled={ticket.scannedOutbound}
            onClick={() => updateScanStatus("scannedOutbound")}
          >
            Scan Outbound
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={ticket.scannedReturn}
            onClick={() => updateScanStatus("scannedReturn")}
          >
            Scan Return
          </Button>
        </Stack>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
