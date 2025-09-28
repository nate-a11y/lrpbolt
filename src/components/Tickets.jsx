/* Proprietary and confidential. See LICENSE. */
// Tickets.jsx — Ticket grid with search, filters, preview, bulk ops
import {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  memo,
  Suspense,
  lazy,
} from "react";
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
  CircularProgress,
} from "@mui/material";
import { GridActionsCellItem } from "@mui/x-data-grid-pro";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EmailIcon from "@mui/icons-material/Email";
import EditIcon from "@mui/icons-material/Edit";
import LocalActivityIcon from "@mui/icons-material/LocalActivity";
import { motion } from "framer-motion";
import relativeTime from "dayjs/plugin/relativeTime";
import { useSearchParams } from "react-router-dom";

import { dayjs } from "@/utils/time";

import logError from "../utils/logError.js";
import { useAuth } from "../context/AuthContext.jsx";
import { withSafeColumns } from "../utils/gridFormatters";
import { useGridDoctor } from "../utils/useGridDoctor";
import {
  subscribeTickets,
  deleteTicket as apiDeleteTicket,
  emailTicket as apiEmailTicket,
} from "../hooks/api";

import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";
import {
  LoadingOverlay,
  NoRowsOverlay,
  ErrorOverlay,
} from "./grid/overlays.jsx";
import PageContainer from "./PageContainer.jsx";
import EditTicketDialog from "./EditTicketDialog.jsx";

const TicketGenerator = lazy(() => import("./TicketGenerator.jsx"));

function TabPanel({ children, value, tabKey }) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== tabKey}
      id={`tickets-tabpanel-${tabKey}`}
      aria-labelledby={`tickets-tab-${tabKey}`}
      sx={{ p: { xs: 1.5, sm: 2 } }}
    >
      {value === tabKey ? children : null}
    </Box>
  );
}

const getTabProps = (key) => ({
  id: `tickets-tab-${key}`,
  "aria-controls": `tickets-tabpanel-${key}`,
});

dayjs.extend(relativeTime);

// null-safe Timestamp → dayjs
function toDayjsTs(v, dayjsLib) {
  if (!v) return null;
  try {
    const d = typeof v.toDate === "function" ? v.toDate() : v;
    const dj = dayjsLib(d);
    return dj.isValid() ? dj : null;
  } catch {
    return null;
  }
}
function formatDate(dj) {
  return dj ? dj.format("MM-DD-YYYY") : "N/A";
}
function formatTime(dj) {
  return dj ? dj.format("h:mm A") : "N/A";
}
function rel(dj) {
  return dj ? dj.fromNow() : "—";
}

function normalizeTicket(raw = {}, dayjsLib) {
  const pickupTime = toDayjsTs(
    raw.pickupTime ||
      raw.createdAt ||
      raw.created ||
      (typeof raw.date === "string" && raw.time
        ? `${raw.date} ${raw.time}`
        : raw.date) ||
      null,
    dayjsLib,
  );
  const pickup =
    raw.pickup ??
    raw.pickupLocation ??
    raw.pickup_location ??
    raw.pickupAddress ??
    raw.pickup_address ??
    "N/A";
  const dropoff =
    raw.dropoff ??
    raw.dropoffLocation ??
    raw.dropoff_location ??
    raw.dropoffAddress ??
    raw.dropoff_address ??
    "N/A";
  return {
    id: raw.ticketId || raw.id || raw.docId || raw._id || null,
    ticketId: raw.ticketId || raw.id || raw.docId || raw._id || "N/A",
    passenger: raw.passenger || raw.passengerName || "N/A",
    passengerCount:
      Number(raw.passengercount ?? raw.passengers ?? raw.passengerCount ?? 0) ||
      0,
    pickup,
    dropoff,
    notes: raw.notes || "",
    pickupTime,
    pickupDateStr: pickupTime ? pickupTime.format("MM-DD-YYYY") : "Unknown",
    pickupTimeStr: pickupTime ? pickupTime.format("h:mm A") : "—",
    scannedOutbound: !!raw.scannedOutbound,
    scannedOutboundAt: toDayjsTs(raw.scannedOutboundAt, dayjsLib),
    scannedOutboundBy: raw.scannedOutboundBy || "",
    scannedReturn: !!raw.scannedReturn,
    scannedReturnAt: toDayjsTs(raw.scannedReturnAt, dayjsLib),
    scannedReturnBy: raw.scannedReturnBy || "",
    linkUrl: raw.ticketId ? `/ticket/${raw.ticketId}` : null,
  };
}

function buildCsv(rows = []) {
  const esc = (s = "") => `"${String(s).replace(/"/g, '""')}"`;
  const header = [
    "Ticket ID",
    "Passenger",
    "Count",
    "Date",
    "Time",
    "Pickup",
    "Dropoff",
    "Scan Status",
  ];
  const body = rows.map((r) => {
    const scan = r.scannedReturn
      ? "Return"
      : r.scannedOutbound
        ? "Outbound"
        : "Not Scanned";
    return [
      r.ticketId,
      r.passenger,
      r.passengerCount,
      formatDate(r.pickupTime),
      formatTime(r.pickupTime),
      r.pickup,
      r.dropoff,
      scan,
    ]
      .map(esc)
      .join(",");
  });
  return [header.join(","), ...body].join("\n");
}
function download(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [filteredDate, setFilteredDate] = useState("All Dates");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
    action: null,
  });
  const [previewTicket, setPreviewTicket] = useState(null);
  const [rowSelectionModel, setRowSelectionModel] = useState([]);
  const selectedIds = Array.isArray(rowSelectionModel) ? rowSelectionModel : [];
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [editingTicket, setEditingTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const previewRef = useRef(null);
  const deleteTimerRef = useRef();
  const [noAccessAlertOpen, setNoAccessAlertOpen] = useState(false);
  const { user, authLoading, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const canGenerate = role === "admin";

  const tabParam = searchParams.get("tab");
  const tabKeys = useMemo(
    () => (canGenerate ? ["list", "summary", "generate"] : ["list", "summary"]),
    [canGenerate],
  );
  const defaultTab = tabKeys[0];
  const activeTab = tabKeys.includes(tabParam) ? tabParam : defaultTab;

  useEffect(() => {
    if (tabParam === "generate" && !canGenerate) {
      setNoAccessAlertOpen(true);
    }
  }, [tabParam, canGenerate]);

  useEffect(() => {
    if (tabParam !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", activeTab);
      setSearchParams(next, { replace: true });
    }
  }, [tabParam, activeTab, searchParams, setSearchParams]);

  const handleTabChange = useCallback(
    (_, value) => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", value);
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const closeNoAccessAlert = useCallback(() => setNoAccessAlertOpen(false), []);

  useEffect(() => {
    if (canGenerate && noAccessAlertOpen) {
      setNoAccessAlertOpen(false);
    }
  }, [canGenerate, noAccessAlertOpen]);

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

  useEffect(() => {
    const id = setTimeout(
      () => setSearchQuery(searchInput.trim().toLowerCase()),
      300,
    );
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    if (authLoading || !user?.email) return;
    setLoading(true);
    setError(null);
    const unsub = subscribeTickets(
      (data) => {
        try {
          const rows = (data || []).map((d) => normalizeTicket(d, dayjs));
          setTickets(rows);
        } catch (e) {
          logError(e);
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setSnackbar({
          open: true,
          message: "Permissions issue loading tickets",
          severity: "error",
          action: null,
        });
        setLoading(false);
      },
    );
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [authLoading, user?.email]);

  const dateOptions = useMemo(() => {
    const dates = Array.from(new Set(tickets.map((t) => t.pickupDateStr)))
      .filter(Boolean)
      .sort();
    return dates;
  }, [tickets]);

  const filteredTickets = useMemo(
    () =>
      tickets.filter((t) => {
        const matchDate =
          filteredDate === "All Dates" || t.pickupDateStr === filteredDate;
        const q = searchQuery;
        const matchSearch =
          !q ||
          [t.ticketId, t.passenger, t.pickup, t.dropoff, t.notes]
            .map((s) => (s || "").toString().toLowerCase())
            .some((s) => s.includes(q));
        return matchDate && matchSearch;
      }),
    [tickets, filteredDate, searchQuery],
  );

  const passengerSummary = useMemo(
    () =>
      filteredTickets.reduce((acc, t) => {
        acc[t.pickupDateStr] =
          (acc[t.pickupDateStr] || 0) + (t.passengerCount || 0);
        return acc;
      }, {}),
    [filteredTickets],
  );

  const rows = useMemo(() => filteredTickets, [filteredTickets]);

  const getRowId = useCallback((r) => r.id || r.ticketId, []);

  const handleEditClick = useCallback((row) => setEditingTicket(row), []);
  const handleEditClose = useCallback(() => setEditingTicket(null), []);

  const handleDeleteClick = useCallback((row) => {
    const snapshot = row;
    setTickets((prev) => prev.filter((t) => t.ticketId !== snapshot.ticketId));
    const undo = () => {
      clearTimeout(deleteTimerRef.current);
      setTickets((prev) => [snapshot, ...prev]);
      setSnackbar({
        open: true,
        message: "♻️ Delete undone",
        severity: "success",
        action: null,
      });
      if (apiDeleteTicket.length > 1) {
        try {
          apiDeleteTicket("undo", snapshot.ticketId, snapshot);
        } catch (e) {
          logError(e);
        }
      }
    };
    setSnackbar({
      open: true,
      message: "🗑️ Ticket deleted — Undo",
      severity: "info",
      action: (
        <Button color="inherit" size="small" onClick={undo}>
          Undo
        </Button>
      ),
    });
    deleteTimerRef.current = setTimeout(async () => {
      try {
        await apiDeleteTicket(snapshot.ticketId);
        setSnackbar({
          open: true,
          message: "✅ Ticket deleted",
          severity: "success",
          action: null,
        });
      } catch (e) {
        logError(e);
        setTickets((prev) => [snapshot, ...prev]);
        setSnackbar({
          open: true,
          message: "❌ Failed to delete ticket",
          severity: "error",
          action: null,
        });
      }
    }, 6000);
  }, []);

  const columns = useMemo(
    () =>
      withSafeColumns([
        {
          field: "ticketId",
          headerName: "Ticket ID",
          minWidth: 140,
          valueGetter: (p) => p?.row?.ticketId || "N/A",
        },
        {
          field: "passenger",
          headerName: "Passenger",
          flex: 1,
          minWidth: 160,
          renderCell: (p) => (
            <Typography fontWeight="bold">
              {p?.row?.passenger || "N/A"}
            </Typography>
          ),
        },
        {
          field: "date",
          headerName: "Date",
          minWidth: 110,
          valueGetter: (p) => formatDate(p?.row?.pickupTime),
        },
        {
          field: "time",
          headerName: "Time",
          minWidth: 110,
          valueGetter: (p) => formatTime(p?.row?.pickupTime),
        },
        {
          field: "pickup",
          headerName: "Pickup",
          minWidth: 160,
          valueGetter: (p) => p?.row?.pickup || "N/A",
        },
        {
          field: "dropoff",
          headerName: "Dropoff",
          minWidth: 160,
          valueGetter: (p) => p?.row?.dropoff || "N/A",
        },
        {
          field: "link",
          headerName: "Link",
          minWidth: 100,
          sortable: false,
          renderCell: (p) =>
            p?.row?.linkUrl ? (
              <a
                href={p.row.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#0af" }}
              >
                View
              </a>
            ) : (
              "N/A"
            ),
        },
        {
          field: "scanStatus",
          headerName: "Scan",
          minWidth: 160,
          sortable: false,
          renderCell: (p) => {
            const r = p?.row || {};
            if (r.scannedReturn) {
              return (
                <Tooltip
                  title={`Return by ${r.scannedReturnBy || "Unknown"} • ${
                    r.scannedReturnAt?.format("MMM D, h:mm A") || "—"
                  }`}
                >
                  <Box
                    sx={{
                      px: 1,
                      py: 0.5,
                      bgcolor: "rgba(76,187,23,0.18)",
                      border: "1px solid #4cbb17",
                      borderRadius: 1,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    ✅ Return • {rel(r.scannedReturnAt, dayjs)}
                  </Box>
                </Tooltip>
              );
            }
            if (r.scannedOutbound) {
              return (
                <Tooltip
                  title={`Outbound by ${r.scannedOutboundBy || "Unknown"} • ${
                    r.scannedOutboundAt?.format("MMM D, h:mm A") || "—"
                  }`}
                >
                  <Box
                    sx={{
                      px: 1,
                      py: 0.5,
                      bgcolor: "rgba(76,187,23,0.12)",
                      border: "1px dashed #4cbb17",
                      borderRadius: 1,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    ↗️ Outbound • {rel(r.scannedOutboundAt, dayjs)}
                  </Box>
                </Tooltip>
              );
            }
            return (
              <Box
                sx={{
                  px: 1,
                  py: 0.5,
                  bgcolor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 1,
                  fontSize: 12,
                }}
              >
                ❌ Not Scanned
              </Box>
            );
          },
        },
        {
          field: "actions",
          type: "actions",
          headerName: "Actions",
          minWidth: 200,
          getActions: (params) => [
            <GridActionsCellItem
              key="preview"
              icon={<DownloadIcon />}
              label="Preview/Download"
              onClick={() => setPreviewTicket(params.row)}
            />,
            <GridActionsCellItem
              key="email"
              icon={<EmailIcon />}
              label="Email"
              onClick={() => {
                setPreviewTicket(params.row);
                setEmailDialogOpen(true);
              }}
            />,
            <GridActionsCellItem
              key="edit"
              icon={<EditIcon />}
              label="Edit"
              onClick={() => handleEditClick(params.row)}
            />,
            <GridActionsCellItem
              key="delete"
              icon={<DeleteIcon />}
              label="Delete"
              onClick={() => handleDeleteClick(params.row)}
            />,
          ],
        },
      ]),
    [handleDeleteClick, handleEditClick],
  );

  useGridDoctor({ name: "Tickets", rows, columns });

  const downloadTicket = useCallback(async () => {
    const node = previewRef.current;
    const t = previewTicket;
    if (!node || !t) return;
    try {
      const dataUrl = await toPng(node, {
        backgroundColor: theme.palette.background.paper,
      });
      const link = document.createElement("a");
      link.download = `${t.ticketId}.png`;
      link.href = dataUrl;
      link.click();
      setSnackbar({
        open: true,
        message: "📸 Ticket saved as image",
        severity: "success",
        action: null,
      });
    } catch (err) {
      logError(err);
      setSnackbar({
        open: true,
        message: "❌ Failed to generate image",
        severity: "error",
        action: null,
      });
    }
  }, [previewTicket, theme.palette.background.paper]);

  const emailTicket = useCallback(async () => {
    const node = previewRef.current;
    const t = previewTicket;
    if (!node || !t || !emailAddress) return;
    setEmailSending(true);
    try {
      const dataUrl = await toPng(node, {
        backgroundColor: theme.palette.background.paper,
      });
      const base64 = dataUrl.split(",")[1];
      const res = await apiEmailTicket(t.ticketId, emailAddress, base64);
      if (res?.success) {
        setSnackbar({
          open: true,
          message: "📧 Ticket emailed",
          severity: "success",
          action: null,
        });
        setEmailDialogOpen(false);
      } else throw new Error("Email failed");
    } catch (err) {
      logError(err);
      setSnackbar({
        open: true,
        message: "❌ Failed to email ticket",
        severity: "error",
        action: null,
      });
    } finally {
      setEmailSending(false);
    }
  }, [previewTicket, emailAddress, theme.palette.background.paper]);

  const bulkDownload = useCallback(async () => {
    const selected = rows.filter((r) =>
      rowSelectionModel.includes(r.id || r.ticketId),
    );
    if (!selected.length) return;
    setBulkDownloading(true);
    try {
      for (const ticket of selected) {
        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = ReactDOM.createRoot(container);
        root.render(
          <Box
            sx={{
              p: 2,
              width: 360,
              bgcolor: theme.palette.background.paper,
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
              <strong>Passenger Count:</strong> {ticket.passengerCount}
            </Typography>
            <Typography>
              <strong>Date:</strong> {formatDate(ticket.pickupTime)}
            </Typography>
            <Typography>
              <strong>Time:</strong> {formatTime(ticket.pickupTime)}
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
        await new Promise((res) => setTimeout(res, 180));
        try {
          const dataUrl = await toPng(container, {
            backgroundColor: theme.palette.background.paper,
          });
          const link = document.createElement("a");
          link.download = `${ticket.ticketId}.png`;
          link.href = dataUrl;
          link.click();
        } catch (err) {
          logError(err);
        } finally {
          root.unmount();
          document.body.removeChild(container);
        }
      }
      setSnackbar({
        open: true,
        message: "📦 Bulk tickets downloaded",
        severity: "success",
        action: null,
      });
    } finally {
      setBulkDownloading(false);
    }
  }, [
    rows,
    rowSelectionModel,
    theme.palette.background.paper,
    theme.palette.text.primary,
  ]);

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
          placeholder="Search tickets"
          variant="outlined"
          size="small"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1, minWidth: 200 }}
        />

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
              disabled={!selectedIds.length || bulkDownloading}
            >
              Bulk Download
            </Button>
          </span>
        </Tooltip>

        <Button
          variant="outlined"
          onClick={() =>
            download(
              `tickets-${dayjs().format("YYYYMMDD-HHmmss")}.csv`,
              buildCsv(rows),
              "text/csv",
            )
          }
        >
          Export CSV
        </Button>
      </Box>

      {noAccessAlertOpen && (
        <Alert severity="warning" onClose={closeNoAccessAlert} sx={{ mb: 2 }}>
          You don’t have access to Generate Ticket.
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{
          mb: 2,
          "& .MuiTabs-indicator": {
            backgroundColor: "#4cbb17",
          },
        }}
      >
        <Tab label="Tickets" value="list" {...getTabProps("list")} />
        <Tab
          label="Passenger Summary"
          value="summary"
          {...getTabProps("summary")}
        />
        {canGenerate && (
          <Tab
            label={isSmall ? "Generate" : "Generate Ticket"}
            value="generate"
            icon={isSmall ? undefined : <LocalActivityIcon fontSize="small" />}
            iconPosition="start"
            {...getTabProps("generate")}
          />
        )}
      </Tabs>

      <TabPanel value={activeTab} tabKey="list">
        <Paper sx={{ width: "100%" }}>
          <SmartAutoGrid
            rows={rows}
            columns={columns}
            getRowId={getRowId}
            checkboxSelection
            disableRowSelectionOnClick
            rowSelectionModel={rowSelectionModel}
            onRowSelectionModelChange={(model) =>
              setRowSelectionModel(Array.isArray(model) ? model : [])
            }
            initialState={initialState}
            pageSizeOptions={[5, 10, 25, 100]}
            columnVisibilityModel={
              isSmall
                ? { link: false, scanStatus: false, pickup: false }
                : undefined
            }
            slots={{
              loadingOverlay: LoadingOverlay,
              noRowsOverlay: NoRowsOverlay,
              errorOverlay: ErrorOverlay,
            }}
            slotProps={{ toolbar: { quickFilterProps: { debounceMs: 300 } } }}
            density="compact"
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
            }}
            loading={loading}
            error={error}
          />
        </Paper>
      </TabPanel>

      <TabPanel value={activeTab} tabKey="summary">
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
      </TabPanel>

      <TabPanel value={activeTab} tabKey="generate">
        {canGenerate && (
          <Suspense
            fallback={
              <Box p={2}>
                <CircularProgress size={20} />
              </Box>
            }
          >
            <TicketGenerator />
          </Suspense>
        )}
      </TabPanel>

      {editingTicket && (
        <EditTicketDialog
          open={Boolean(editingTicket)}
          ticket={editingTicket}
          onClose={handleEditClose}
        />
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
            mt: 8,
            outline: "none",
          }}
        >
          {previewTicket && (
            <>
              <Box ref={previewRef}>
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
                  <strong>Passenger:</strong> {previewTicket.passenger}
                </Typography>
                <Typography>
                  <strong>Passenger Count:</strong>{" "}
                  {previewTicket.passengerCount}
                </Typography>
                <Typography>
                  <strong>Date:</strong> {formatDate(previewTicket.pickupTime)}
                </Typography>
                <Typography>
                  <strong>Time:</strong> {formatTime(previewTicket.pickupTime)}
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
                {previewTicket.scannedOutbound && (
                  <Typography>
                    <strong>Outbound:</strong>{" "}
                    {previewTicket.scannedOutboundAt?.format("MMM D, h:mm A") ||
                      "—"}
                    {" by "}
                    {previewTicket.scannedOutboundBy || "Unknown"}
                  </Typography>
                )}
                {previewTicket.scannedReturn && (
                  <Typography>
                    <strong>Return:</strong>{" "}
                    {previewTicket.scannedReturnAt?.format("MMM D, h:mm A") ||
                      "—"}
                    {" by "}
                    {previewTicket.scannedReturnBy || "Unknown"}
                  </Typography>
                )}
                <Box mt={2} display="flex" justifyContent="center">
                  <Box
                    p={1.5}
                    bgcolor={(t) => t.palette.background.paper}
                    borderRadius={2}
                    boxShadow="0 0 10px #4cbb17"
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
                  variant="contained"
                  color="success"
                  onClick={downloadTicket}
                  sx={{
                    boxShadow: "0 0 8px 2px #4cbb17",
                    fontWeight: 700,
                  }}
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
            <Button
              onClick={emailTicket}
              variant="contained"
              color="primary"
              disabled={emailSending}
            >
              Send
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.action ? 6000 : 4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          action={snackbar.action}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
}

export default memo(Tickets);
