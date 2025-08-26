/* Proprietary and confidential. See LICENSE. */
// Tickets.jsx — Email, Download, Search, Summary, Scanner Status
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
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
  useTheme,
  useMediaQuery,
  Stack,
} from "@mui/material";
import { DataGridPro, GridActionsCellItem } from "@mui/x-data-grid-pro";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EmailIcon from "@mui/icons-material/Email";
import { motion } from "framer-motion";
import { Timestamp } from "firebase/firestore";

import { safeRow } from "@/utils/gridUtils";

import {
  subscribeTickets,
  deleteTicket as apiDeleteTicket,
  emailTicket as apiEmailTicket,
} from "../hooks/api";
import { logError } from "../utils/logError";
import { useAuth } from "../context/AuthContext.jsx";
import { asArray } from "../utils/arrays.js";
import { fmtPlain, warnMissingFields } from "../utils/gridFormatters";
import { useGridDoctor } from "../utils/useGridDoctor";

import useGridProDefaults from "./grid/useGridProDefaults.js";
import PageContainer from "./PageContainer.jsx";

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [filteredDate, setFilteredDate] = useState("All Dates");
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [tab, setTab] = useState(0);
  const [previewTicket, setPreviewTicket] = useState(null);
  const [rowSelectionModel, setRowSelectionModel] = useState([]);
  const selectedIds = rowSelectionModel;
  const [_deletingId, setDeletingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const previewRef = useRef(null);
  const { user, authLoading } = useAuth();
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const grid = useGridProDefaults({ gridId: "tickets" });
  const initialState = useMemo(
    () => ({
      ...grid.initialState,
      columns: {
        ...grid.initialState.columns,
        columnVisibilityModel: {
          link: !isSmall,
          scanStatus: !isSmall,
          pickup: !isSmall,
          ...grid.initialState.columns.columnVisibilityModel,
        },
      },
    }),
    [grid.initialState, isSmall],
  );

  // ✅ Real-time ticket subscription with indexed search
  useEffect(() => {
    if (authLoading || !user?.email) return;
    const filters = {};
    if (searchQuery.trim()) filters.passenger = searchQuery.trim();
    if (filteredDate !== "All Dates") {
      filters.pickupTime = Timestamp.fromDate(
        dayjs(filteredDate, "MM-DD-YYYY").toDate(),
      );
    }
    const unsubscribe = subscribeTickets(
      (data) => setTickets(data),
      filters,
      () =>
        setSnackbar({
          open: true,
          message: "Permissions issue loading tickets",
          severity: "error",
        }),
    );
    return () => unsubscribe();
  }, [authLoading, user?.email, searchQuery, filteredDate]);

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
        backgroundColor: theme.palette.background.paper,
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
          sx={{
            p: 2,
            width: 360,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 2,
            color: theme.palette.text.primary,
          }}
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
        backgroundColor: theme.palette.background.paper,
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

  const handleDeleteClick = useCallback((row) => handleDelete(row.ticketId), [handleDelete]);
  const handleDownload = useCallback((row) => setPreviewTicket(row), []);

  const columns = useMemo(
    () => [
      { field: "ticketId", headerName: "Ticket ID", minWidth: 120 },
      {
        field: "passenger",
        headerName: "Passenger",
        minWidth: 130,
        flex: 1,
        renderCell: (params = {}) => (
          <Typography fontWeight="bold">{params?.value}</Typography>
        ),
      },
      { field: "date", headerName: "Date", minWidth: 110, valueFormatter: fmtPlain("—") },
      { field: "pickup", headerName: "Pickup", minWidth: 110, valueFormatter: fmtPlain("—") },
      {
        field: "link",
        headerName: "Link",
        minWidth: 100,
        sortable: false,
        renderCell: (p = {}) => {
          const id = safeRow(p)?.ticketId;
          return (
            <a
              href={`/ticket/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#0af" }}
            >
              View
            </a>
          );
        },
      },
      {
        field: "scanStatus",
        headerName: "Scan",
        minWidth: 120,
        renderCell: (p = {}) => {
          const r = safeRow(p);
          if (r?.scannedReturn) return "✅ Return";
          if (r?.scannedOutbound) return "↗️ Outbound";
          return "❌ Not Scanned";
        },
      },
      {
        field: "actions",
        type: "actions",
        headerName: "Actions",
        minWidth: 120,
        getActions: (params) => [
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label="Delete"
            onClick={() => handleDeleteClick(params.row)}
            showInMenu={false}
          />,
          <GridActionsCellItem
            key="download"
            icon={<DownloadIcon />}
            label="Download"
            onClick={() => handleDownload(params.row)}
            showInMenu={false}
          />,
        ],
      },
    ],
    [handleDeleteClick, handleDownload],
  );

  const rows = useMemo(
    () => (filteredTickets ?? []).map((t) => ({ id: t.ticketId, ...t })),
    [filteredTickets],
  );
  useGridDoctor({ name: "Tickets", rows, columns });

  useEffect(() => {
    if (import.meta.env.MODE !== "production") warnMissingFields(columns, rows);
  }, [rows, columns]);
  return (
    <PageContainer maxWidth={960}>
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
            variant="outlined"
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
        isSmall ? (
          <Stack spacing={2} sx={{ mb: 2 }}>
            {filteredTickets.map((t) => (
              <Paper key={t.ticketId} variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2">{t.ticketId}</Typography>
                <Typography variant="body2">Passenger: {t.passenger}</Typography>
                <Typography variant="body2">Date: {t.date}</Typography>
                <Typography variant="body2">Pickup: {t.pickup}</Typography>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Box sx={{ width: '100%', overflowX: 'auto' }}>
              <DataGridPro
                {...grid}
                rows={rows}
                columns={columns}
                getRowId={(r) => r.id ?? r.ticketId ?? r._id}
                autoHeight
                checkboxSelection
                pageSizeOptions={[5, 10, 25, 100]}
                density="compact"
                disableRowSelectionOnClick
                onRowSelectionModelChange={(model) =>
                  setRowSelectionModel(asArray(model))
                }
                rowSelectionModel={rowSelectionModel ?? []}
                initialState={initialState}
                sx={{
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
              columnVisibilityModel={isSmall ? { link: false, scanStatus: false, pickup: false } : undefined}
            />
          </Box>
        )
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
                sx={{
                  p: 2,
                  backgroundColor: theme.palette.background.paper,
                  borderRadius: 2,
                  color: theme.palette.text.primary,
                }}
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
                  sx={{ color: theme.palette.text.primary }}
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
                    p={1.5}
                    bgcolor={(t) => t.palette.background.paper}
                    borderRadius={2}
                    boxShadow="0 0 10px lime"
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
    </PageContainer>
  );
}
