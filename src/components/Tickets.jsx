/* Proprietary and confidential. See LICENSE. */
// Tickets.jsx — Email, Download, Search, Summary, Scanner Status
import { useEffect, useState, useRef, useMemo, useCallback, memo } from "react";
import ReactDOM from "react-dom/client";
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
} from "@mui/material";
import { GridActionsCellItem, GridToolbar } from "@mui/x-data-grid-pro";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EmailIcon from "@mui/icons-material/Email";
import EditIcon from "@mui/icons-material/Edit";
import { motion } from "framer-motion";
import { Timestamp } from "firebase/firestore";

import { dayjs } from "@/utils/time";
import { safeRow } from "@/utils/gridUtils";
import { assertGridScrollable } from "@/utils/devGridCheck";

import {
  subscribeTickets,
  deleteTicket as apiDeleteTicket,
  emailTicket as apiEmailTicket,
} from "../hooks/api";
import logError from "../utils/logError.js";
import { useAuth } from "../context/AuthContext.jsx";
import { withSafeColumns } from "../utils/gridFormatters";
import { useGridDoctor } from "../utils/useGridDoctor";

import PageContainer from "./PageContainer.jsx";
import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";
import {
  LoadingOverlay,
  NoRowsOverlay,
  ErrorOverlay,
} from "./grid/overlays.jsx";
import EditTicketDialog from "./EditTicketDialog.jsx";

function Tickets() {
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
  const selectedIds = Array.isArray(rowSelectionModel) ? rowSelectionModel : [];
  const [_deletingId, setDeletingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [editingTicket, setEditingTicket] = useState(null);
  const previewRef = useRef(null);
  const scrollRef = useRef(null);
  const { user, authLoading } = useAuth();
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const initialState = useMemo(
    () => ({
      columns: {
        columnVisibilityModel: {
          link: !isSmall,
          scanStatus: !isSmall,
          pickup: !isSmall,
        },
      },
    }),
    [isSmall],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getTicketDate = useCallback((t = {}) => {
    const src = t?.pickupTime || t?.createdAt || t?.created || t?.date || null;
    const d = src && typeof src.toDate === "function" ? src.toDate() : src;
    return d && dayjs(d).isValid() ? dayjs(d) : null;
  }, []);

  const dateOptions = useMemo(
    () =>
      Array.from(
        new Set(
          tickets
            .map((t) => getTicketDate(t)?.format("MM-DD-YYYY"))
            .filter(Boolean),
        ),
      ).sort(),
    [tickets, getTicketDate],
  );

  useEffect(() => {
    if (import.meta.env.MODE !== "production") {
      assertGridScrollable(scrollRef.current);
    }
  }, []);

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
    setLoading(true);
    setError(null);
    const unsubscribe = subscribeTickets(
      (data) => {
        setTickets(data);
        setLoading(false);
      },
      filters,
      (err) => {
        setError(err);
        setSnackbar({
          open: true,
          message: "Permissions issue loading tickets",
          severity: "error",
        });
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [authLoading, user?.email, searchQuery, filteredDate]);

  const filteredTickets = tickets.filter((t = {}) => {
    const d = getTicketDate(t);
    const dateStr = d ? d.format("MM-DD-YYYY") : "Unknown";
    const matchDate = filteredDate === "All Dates" || dateStr === filteredDate;

    const q = searchQuery.toLowerCase();
    const ticketId = (t.ticketId || "").toString().toLowerCase();
    const passenger = (t.passenger || "").toLowerCase();
    const matchSearch = !q || ticketId.includes(q) || passenger.includes(q);

    return matchDate && matchSearch;
  });

  const passengerSummary = filteredTickets.reduce((acc, t = {}) => {
    const d = getTicketDate(t);
    const date = d ? d.format("MM-DD-YYYY") : "Unknown";
    const count = parseInt(t.passengers ?? 0, 10);
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

  const handleDelete = useCallback(async (ticketId) => {
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
  }, []);

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
            <strong>Passenger Count:</strong> {ticket.passengers}
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

  const handleDeleteClick = useCallback(
    (row) => handleDelete(row.ticketId),
    [handleDelete],
  );
  const handleDownload = useCallback((row) => setPreviewTicket(row), []);
  const handleEmail = useCallback((row) => {
    setPreviewTicket(row);
    setEmailDialogOpen(true);
  }, []);
  const handleEditClick = useCallback((row) => setEditingTicket(row), []);
  const handleEditClose = useCallback(
    (updated) => {
      setEditingTicket(null);
      if (updated) {
        setTickets((prev) =>
          prev.map((t) =>
            t.ticketId === updated.ticketId ? { ...t, ...updated } : t,
          ),
        );
        setSnackbar({
          open: true,
          message: "✏️ Ticket updated",
          severity: "success",
        });
      }
    },
    [setTickets, setSnackbar],
  );

  const rawColumns = useMemo(
    () => [
      {
        field: "ticketId",
        headerName: "Ticket ID",
        minWidth: 120,
        valueGetter: (p) => p?.row?.ticketId ?? "N/A",
      },
      {
        field: "passenger",
        headerName: "Passenger",
        minWidth: 130,
        flex: 1,
        renderCell: (params = {}) => (
          <Typography fontWeight="bold">{params?.value ?? "N/A"}</Typography>
        ),
      },
      {
        field: "date",
        headerName: "Date",
        minWidth: 110,
        valueGetter: (p) => {
          const d = getTicketDate(p?.row);
          return d ? d.format("MM-DD-YYYY") : "N/A";
        },
      },
      {
        field: "pickup",
        headerName: "Pickup",
        minWidth: 110,
        valueGetter: (p) => {
          const r = p?.row || {};
          return r.pickup ?? r.pickupLocation ?? r.pickup_location ?? "N/A";
        },
      },
      {
        field: "dropoff",
        headerName: "Dropoff",
        minWidth: 110,
        valueGetter: (p) => {
          const r = p?.row || {};
          return r.dropoff ?? r.dropoffLocation ?? r.dropoff_location ?? "N/A";
        },
      },
      {
        field: "link",
        headerName: "Link",
        minWidth: 100,
        sortable: false,
        renderCell: (p = {}) => {
          const id = safeRow(p)?.ticketId;
          if (!id) return "N/A";
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
        minWidth: 150,
        getActions: (params) => [
          <GridActionsCellItem
            key="edit"
            icon={<EditIcon />}
            label="Edit"
            onClick={() => handleEditClick(params.row)}
            showInMenu={false}
          />,
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
          <GridActionsCellItem
            key="email"
            icon={<EmailIcon />}
            label="Email"
            onClick={() => handleEmail(params.row)}
            showInMenu={false}
          />,
        ],
      },
    ],
    [
      handleDeleteClick,
      handleDownload,
      handleEmail,
      handleEditClick,
      getTicketDate,
    ],
  );

  const columns = useMemo(() => withSafeColumns(rawColumns), [rawColumns]);

  const rows = useMemo(
    () =>
      (filteredTickets ?? []).map((t = {}) => ({
        id: t.ticketId || t.id,
        ...t,
      })),
    [filteredTickets],
  );

  const getRowId = useCallback(
    (r) =>
      r?.id ?? r?.ticketId ?? r?.uid ?? r?.docId ?? r?._id ?? JSON.stringify(r),
    [],
  );
  useGridDoctor({ name: "Tickets", rows, columns });

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
            {dateOptions.map((date) => (
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
        <Box ref={scrollRef}>
          <Paper sx={{ width: "100%" }}>
            <SmartAutoGrid
              rows={rows || []}
              columns={columns || []}
              getRowId={getRowId}
              autoHeight
              checkboxSelection
              disableRowSelectionOnClick
              onRowSelectionModelChange={(model) =>
                setRowSelectionModel(Array.isArray(model) ? model : [])
              }
              rowSelectionModel={
                Array.isArray(rowSelectionModel) ? rowSelectionModel : []
              }
              initialState={initialState}
              pageSizeOptions={[5, 10, 25, 100]}
              columnVisibilityModel={
                isSmall
                  ? { link: false, scanStatus: false, pickup: false }
                  : undefined
              }
              slots={{
                toolbar: GridToolbar,
                loadingOverlay: LoadingOverlay,
                noRowsOverlay: NoRowsOverlay,
                errorOverlay: ErrorOverlay,
              }}
              slotProps={{
                pagination: { labelRowsPerPage: "Rows" },
                toolbar: { quickFilterProps: { debounceMs: 500 } },
              }}
              showToolbar
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
                "& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus":
                  {
                    outline: "none",
                  },
                "& .MuiDataGrid-footerContainer": {
                  flexWrap: { xs: "wrap", sm: "nowrap" },
                },
                "& .MuiTablePagination-toolbar": {
                  flexWrap: { xs: "wrap", sm: "nowrap" },
                },
              }}
              loading={loading}
              error={error}
            />
          </Paper>
        </Box>
      )}
      {editingTicket && (
        <EditTicketDialog
          open={Boolean(editingTicket)}
          ticket={editingTicket}
          onClose={handleEditClose}
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
                  <strong>Passenger Count:</strong> {previewTicket.passengers}
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

      {emailDialogOpen && (
        <Dialog
          open
          onClose={() => setEmailDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
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
      )}

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

export default memo(Tickets);
