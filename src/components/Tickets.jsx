/* Proprietary and confidential. See LICENSE. */
// Tickets.jsx — Email, Download, Search, Summary, Scanner Status
import React, { useState, useRef } from "react";
import ReactDOM from "react-dom/client";
import dayjs from "dayjs";
import QRCode from "react-qr-code";
import { toPng } from "html-to-image";
import {
  Box,
  Typography,
  Paper,
  Divider,
  Button,
  Modal,
  TextField,
  IconButton,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  InputAdornment,
  OutlinedInput,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import EmailIcon from "@mui/icons-material/Email";
import SearchIcon from "@mui/icons-material/Search";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { brand } from "../theme";
import { motion } from "framer-motion";
import { collection, query, where, orderBy, Timestamp } from "firebase/firestore";

import {
  deleteTicket as apiDeleteTicket,
  emailTicket as apiEmailTicket,
} from "../hooks/api";
import { db } from "../utils/firebaseInit";
import useFirestoreSub from "../hooks/useFirestoreSub";
import { logError } from "../utils/logError";
import { useAuth } from "../context/AuthContext.jsx";
import { safeGetter } from "../utils/datagridSafe";

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [filteredDate, setFilteredDate] = useState("All Dates");
  const [editOpen, setEditOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [deletingId, setDeletingId] = useState(null);
  const [tab, setTab] = useState(0);
  const [previewTicket, setPreviewTicket] = useState(null);
  const [rowSelectionModel, setRowSelectionModel] = useState({
    type: "include",
    ids: new Set(),
  });
  const selectedIds = Array.from(rowSelectionModel.ids);
  const [searchQuery, setSearchQuery] = useState("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const previewRef = useRef(null);
  const { user, authLoading } = useAuth();

  // ✅ Real-time ticket subscription with indexed search
  useFirestoreSub(
    `tickets:pass=${searchQuery || ""}|date=${filteredDate}`,
    () => {
      if (authLoading || !user?.email) return null;
      const col = collection(db, "tickets");
      const clauses = [];
      if (searchQuery.trim()) clauses.push(where("passenger", "==", searchQuery.trim()));
      if (filteredDate !== "All Dates") {
        clauses.push(
          where(
            "pickupTime",
            "==",
            Timestamp.fromDate(dayjs(filteredDate, "MM-DD-YYYY").toDate()),
          ),
        );
      }
      clauses.push(orderBy("pickupTime", "asc"));
      return query(col, ...clauses);
    },
    (snap) => setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () =>
      setSnackbar({
        open: true,
        message: "Permissions issue loading tickets",
        severity: "error",
      }),
    [authLoading, user?.email, searchQuery, filteredDate]
  );

  const filteredTickets = tickets.filter((t) => {
    const matchDate =
      filteredDate === "All Dates" ||
      (dayjs(t.date).isValid()
        ? dayjs(t.date).format("MM-DD-YYYY") === filteredDate
        : t.date === filteredDate);

    const matchSearch = t.ticketId
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    return matchDate && matchSearch;
  });

  const passengerSummary = filteredTickets.reduce((acc, t) => {
    const date = dayjs(t.date).isValid()
      ? dayjs(t.date).format("MM-DD-YYYY")
      : t.date || "Unknown";
    const count = parseInt(t.passengercount ?? 0, 10);
    acc[date] = (acc[date] || 0) + count;
    return acc;
  }, {});
  const downloadTicket = async () => {
    if (!previewRef.current || !previewTicket) return;
    try {
      const dataUrl = await toPng(previewRef.current, {
        backgroundColor: brand.white,
      });
      const link = document.createElement("a");
      link.download = `${previewTicket.ticketId}.png`;
      link.href = dataUrl;
      link.click();
      setSnackbar({
        open: true,
        message: "📸 Ticket saved as image",
        severity: "success",
      });
    } catch (err) {
      logError(err, "Download failed");
      setSnackbar({
        open: true,
        message: "❌ Failed to generate image",
        severity: "error",
      });
    }
  };

  const handleDelete = async (ticketId) => {
    const confirmDelete = window.confirm(`Delete ticket ${ticketId}?`);
    if (!confirmDelete) return;

    setDeletingId(ticketId);
    try {
      const data = await apiDeleteTicket(ticketId);
      if (data.success) {
        setTickets((prev) => prev.filter((t) => t.ticketId !== ticketId));
        setSnackbar({
          open: true,
          message: "🗑️ Ticket deleted",
          severity: "success",
        });
      } else {
        throw new Error("Delete failed");
      }
    } catch (err) {
      logError(err, "Delete error");
      setSnackbar({
        open: true,
        message: "❌ Failed to delete ticket",
        severity: "error",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const bulkDownload = async () => {
    const selected = tickets.filter((t) => selectedIds.includes(t.ticketId));
    for (const ticket of selected) {
      const container = document.createElement("div");
      document.body.appendChild(container);

      const root = ReactDOM.createRoot(container);
      root.render(
        <Box
          sx={(t) => ({
            p: 2,
            width: 360,
            backgroundColor: t.palette.background.paper,
            borderRadius: 2,
            color: t.palette.text.primary,
          })}
        >
          <Box display="flex" justifyContent="center" mb={2}>
            <img
              src="/android-chrome-512x512.png"
              alt="Lake Ride Pros"
              style={{ height: 48 }}
            />
          </Box>
          <Typography variant="h6" align="center" gutterBottom>
            🎟️ Shuttle Ticket
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Typography>
            <strong>Passenger:</strong> {ticket.passenger}
          </Typography>
          <Typography>
            <strong>Passenger Count:</strong> {ticket.passengercount}
          </Typography>
          <Typography>
            <strong>Date:</strong> {ticket.date}
          </Typography>
          <Typography>
            <strong>Time:</strong> {ticket.time}
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
          <Typography>
            <strong>Ticket ID:</strong> {ticket.ticketId}
          </Typography>
          <Box mt={2} display="flex" justifyContent="center">
            <QRCode
              value={`https://lakeridepros.xyz/ticket/${ticket.ticketId}`}
              size={160}
            />
          </Box>
        </Box>,
      );

      await new Promise((res) => setTimeout(res, 250));

      try {
        const dataUrl = await toPng(container);
        const link = document.createElement("a");
        link.download = `${ticket.ticketId}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        logError(err, "Bulk download failed");
      } finally {
        root.unmount();
        document.body.removeChild(container);
      }
    }
    setSnackbar({
      open: true,
      message: "📦 Bulk tickets downloaded",
      severity: "success",
    });
  };

  const emailTicket = async () => {
    if (!previewRef.current || !previewTicket || !emailAddress) return;
    try {
      const dataUrl = await toPng(previewRef.current, {
        backgroundColor: brand.white,
      });
      const base64 = dataUrl.split(",")[1];
      const data = await apiEmailTicket(
        previewTicket.ticketId,
        emailAddress,
        base64,
      );
      if (data.success) {
        setSnackbar({
          open: true,
          message: "📧 Ticket emailed",
          severity: "success",
        });
      } else throw new Error("Email failed");
    } catch (err) {
      logError(err, "Email error");
      setSnackbar({
        open: true,
        message: "❌ Email failed",
        severity: "error",
      });
    }
    setEmailDialogOpen(false);
    setEmailAddress("");
  };

  const columns = [
    { field: "ticketId", headerName: "Ticket ID", minWidth: 120 },
    {
      field: "passenger",
      headerName: "Passenger",
      minWidth: 130,
      flex: 1,
      renderCell: (params) => (
        <Typography fontWeight="bold">{params.value}</Typography>
      ),
    },
    { field: "date", headerName: "Date", minWidth: 110 },
    { field: "pickup", headerName: "Pickup", minWidth: 110 },
    {
      field: "link",
      headerName: "Link",
      minWidth: 100,
      sortable: false,
      valueGetter: safeGetter((p) => p?.row?.ticketId),
      renderCell: (params) => (
        <a
          href={`/ticket/${params.value}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#0af" }}
        >
          View
        </a>
      ),
    },
    {
      field: "scanStatus",
      headerName: "Scan",
      minWidth: 120,
      renderCell: ({ row } = {}) => {
        if (row?.scannedReturn) return "✅ Return";
        if (row?.scannedOutbound) return "↗️ Outbound";
        return "❌ Not Scanned";
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 160,
      sortable: false,
      renderCell: (params) => {
        const row = params?.row;
        if (!row) return null;
        return (
          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title="Edit">
              <IconButton
                size="small"
                color="primary"
                onClick={() => setSelectedTicket(row)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <span>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDelete(row.ticketId)}
                  disabled={deletingId === row.ticketId}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Download">
              <IconButton
                size="small"
                color="success"
                onClick={() => setPreviewTicket(row)}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      },
    },
  ];
  return (
    <Box sx={{ maxWidth: 960, mx: "auto", mt: 4, px: { xs: 1, sm: 3 } }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        🎟️ Shuttle Ticket Overview
      </Typography>

      <Box
        display="flex"
        gap={2}
        mb={2}
        flexDirection={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
      >
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Date Filter</InputLabel>
          <Select
            label="Date Filter"
            value={filteredDate}
            onChange={(e) => setFilteredDate(e.target.value)}
            input={
              <OutlinedInput
                label="Date Filter"
                startAdornment={
                  <InputAdornment position="start">
                    <CalendarMonthIcon fontSize="small" />
                  </InputAdornment>
                }
              />
            }
          >
            <MenuItem value="All Dates">All Dates</MenuItem>
            {[
              ...new Set(
                tickets.map((t) =>
                  dayjs(t.date).isValid()
                    ? dayjs(t.date).format("MM-DD-YYYY")
                    : t.date,
                ),
              ),
            ]
              .sort()
              .map((date) => (
                <MenuItem key={date} value={date}>
                  {date}
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        <TextField
          placeholder="Search by Passenger or Ticket ID"
          variant="outlined"
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1, minWidth: 200 }}
        />

        <Button
          onClick={() =>
            setSnackbar({
              open: true,
              message: "🔥 Real-time updates active",
              severity: "info",
            })
          }
          variant="contained"
          color="primary"
          startIcon={<RefreshIcon />}
        >
          Refresh
        </Button>
        <Tooltip
          title={
            selectedIds.length
              ? "Download selected tickets"
              : "Select tickets to enable"
          }
        >
          <span>
            <Button
              onClick={bulkDownload}
              variant="contained"
              color="success"
              startIcon={<DownloadIcon />}
              disabled={!selectedIds.length}
            >
              Bulk Download
            </Button>
          </span>
        </Tooltip>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, val) => setTab(val)}
        textColor="primary"
        indicatorColor="primary"
        sx={{
          mb: 2,
          "& .MuiTab-root.Mui-selected": { fontWeight: "bold" },
          "& .MuiTab-root:hover": { color: "primary.main" },
        }}
      >
        <Tab label="Ticket List" />
        <Tab label="Passenger Summary" />
      </Tabs>

      {tab === 0 && (
        <DataGrid
          rows={filteredTickets.map((t) => ({ id: t.ticketId, ...t }))}
          columns={columns}
          getRowId={(r) => r.id ?? `${r.ticketId}-${r.date ?? Math.random()}`}
          autoHeight
          checkboxSelection
          pageSizeOptions={[5, 10, 25, 100]}
          density="comfortable"
          disableRowSelectionOnClick
          onRowSelectionModelChange={(model) => setRowSelectionModel(model)}
          rowSelectionModel={rowSelectionModel}
          sx={{
            bgcolor: (t) => t.palette.background.paper,
            "& .MuiDataGrid-cell, & .MuiDataGrid-columnHeader": { color: (t) => t.palette.text.primary },
            "& .MuiTablePagination-root": { color: (t) => t.palette.text.secondary },
            borderColor: "divider",
            "& .MuiDataGrid-row:nth-of-type(odd)": {
              backgroundColor: "rgba(255,255,255,0.04)",
            },
            "& .MuiDataGrid-row:hover": {
              backgroundColor: "rgba(76,187,23,0.1)",
            },
            "& .MuiDataGrid-row.Mui-selected": {
              backgroundColor: "rgba(76,187,23,0.2)",
            },
            "& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus": {
              outline: "none",
            },
            "& .MuiDataGrid-footerContainer": {
              flexWrap: { xs: "wrap", sm: "nowrap" },
            },
            "& .MuiTablePagination-toolbar": {
              flexWrap: { xs: "wrap", sm: "nowrap" },
            },
          }}
          slotProps={{
            pagination: { labelRowsPerPage: "Rows" },
          }}
        />
      )}

      {tab === 1 && (
        <Paper sx={{ p: 3 }} elevation={4}>
          <Typography variant="h6" gutterBottom>
            🧮 Passenger Summary by Date
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <ul>
            {Object.entries(passengerSummary)
              .sort()
              .map(([date, count]) => (
                <li key={date}>
                  <strong>{date}:</strong> {count} passengers
                </li>
              ))}
          </ul>
        </Paper>
      )}

      <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)}>
        <DialogTitle>Email Ticket</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Email Address"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            type="email"
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
          <Button onClick={emailTicket} variant="contained" color="primary">
            Send
          </Button>
        </DialogActions>
      </Dialog>

      <Modal open={!!previewTicket} onClose={() => setPreviewTicket(null)}>
        <Box
          component={motion.div}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          sx={{
            backgroundColor: "background.paper",
            borderRadius: 2,
            p: 4,
            width: 360,
            mx: "auto",
            mt: "10vh",
            boxShadow: 24,
          }}
        >
          {previewTicket && (
            <>
              <Box
                ref={previewRef}
                sx={(t) => ({
                  p: 2,
                  backgroundColor: t.palette.background.paper,
                  borderRadius: 2,
                  color: t.palette.text.primary,
                })}
              >
                <Box display="flex" justifyContent="center" mb={2}>
                  <img
                    src="/android-chrome-512x512.png"
                    alt="Lake Ride Pros"
                    style={{ height: 48 }}
                  />
                </Box>
                <Typography
                  variant="h6"
                  align="center"
                  gutterBottom
                  sx={{ color: "#000" }}
                >
                  🎟️ Shuttle Ticket
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Typography>
                  <strong>Passenger:</strong> {previewTicket.passenger}
                </Typography>
                <Typography>
                  <strong>Passenger Count:</strong>{" "}
                  {previewTicket.passengercount}
                </Typography>
                <Typography>
                  <strong>Date:</strong> {previewTicket.date}
                </Typography>
                <Typography>
                  <strong>Time:</strong> {previewTicket.time}
                </Typography>
                <Typography>
                  <strong>Pickup:</strong> {previewTicket.pickup}
                </Typography>
                <Typography>
                  <strong>Dropoff:</strong> {previewTicket.dropoff}
                </Typography>
                {previewTicket.notes && (
                  <Typography>
                    <strong>Notes:</strong> {previewTicket.notes}
                  </Typography>
                )}
                <Typography>
                  <strong>Ticket ID:</strong> {previewTicket.ticketId}
                </Typography>
                <Typography>
                  <strong>Scanned By:</strong> {previewTicket.scannedBy || "—"}
                </Typography>
                <Box mt={2} display="flex" justifyContent="center">
                  <Box
                    sx={(t) => ({
                      p: 1.5,
                      bgcolor: t.palette.background.paper,
                      borderRadius: 2,
                      boxShadow: `0 0 10px ${t.palette.primary.main}`,
                    })}
                  >
                    <QRCode
                      value={`https://lakeridepros.xyz/ticket/${previewTicket.ticketId}`}
                      size={160}
                    />
                  </Box>
                </Box>
              </Box>

              <Box mt={3} display="flex" justifyContent="space-between">
                <Button
                  variant="outlined"
                  color="info"
                  startIcon={<EmailIcon />}
                  onClick={() => setEmailDialogOpen(true)}
                >
                  Email
                </Button>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => window.print()}
                >
                  Print
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  onClick={downloadTicket}
                  sx={{ boxShadow: "0 0 8px 2px lime", fontWeight: 700 }}
                >
                  Download
                </Button>
                <Button variant="text" onClick={() => setPreviewTicket(null)}>
                  Close
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Modal>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
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
