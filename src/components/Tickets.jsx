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
  AppBar,
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
  FormControlLabel,
  Switch,
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
  Toolbar,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Chip,
  Fab,
  IconButton,
} from "@mui/material";
import { GridActionsCellItem } from "@mui/x-data-grid-pro";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EmailIcon from "@mui/icons-material/Email";
import EditIcon from "@mui/icons-material/Edit";
import LocalActivityIcon from "@mui/icons-material/LocalActivity";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import CloseIcon from "@mui/icons-material/Close";
import { motion } from "framer-motion";
import relativeTime from "dayjs/plugin/relativeTime";
import { useSearchParams } from "react-router-dom";

import { formatDateTime, dayjs, toDayjs } from "@/utils/time";
import { getScanStatus, getScanMeta } from "@/utils/ticketMap";
import {
  subscribeTickets,
  snapshotTicketsByIds,
  deleteTicketsByIds,
  restoreTickets,
} from "@/services/tickets";

import logError from "../utils/logError.js";
import { useAuth } from "../context/AuthContext.jsx";
import { withSafeColumns } from "../utils/gridFormatters";
import { useGridDoctor } from "../utils/useGridDoctor";
import { emailTicket as apiEmailTicket } from "../hooks/api";

import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";
import {
  LoadingOverlay,
  NoRowsOverlay,
  ErrorOverlay,
} from "./grid/overlays.jsx";
import PageContainer from "./PageContainer.jsx";
import EditTicketDialog from "./EditTicketDialog.jsx";

const TicketGenerator = lazy(() => import("./TicketGenerator.jsx"));
const TicketScanner = lazy(() => import("./TicketScanner.jsx"));

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
  const docId = raw.id || raw.docId || raw._id || raw.ticketId || null;
  const ticketId = raw.ticketId || docId || "N/A";
  return {
    id: docId,
    ticketId,
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

const scanChipSx = {
  Both: {
    bgcolor: "rgba(76,187,23,0.18)",
    color: "#4cbb17",
    border: "1px solid rgba(76,187,23,0.35)",
  },
  Outbound: {
    bgcolor: "rgba(76,187,23,0.12)",
    color: "#4cbb17",
    border: "1px solid rgba(76,187,23,0.25)",
  },
  Return: {
    bgcolor: "action.selected",
    color: "text.primary",
  },
  Unscanned: {
    bgcolor: "rgba(255,255,255,0.08)",
    color: "text.secondary",
    border: "1px solid rgba(255,255,255,0.12)",
  },
};

function ScanStatusCell(params) {
  const row = params?.row || {};
  const status = getScanStatus(row);
  const { outAt, outBy, retAt, retBy } = getScanMeta(row);
  const tip =
    status === "Unscanned"
      ? "Not scanned"
      : status === "Outbound"
        ? `Outbound by ${outBy || "N/A"} @ ${formatDateTime(outAt)}`
        : status === "Return"
          ? `Return by ${retBy || "N/A"} @ ${formatDateTime(retAt)}`
          : `Outbound by ${outBy || "N/A"} @ ${formatDateTime(outAt)} • Return by ${retBy || "N/A"} @ ${formatDateTime(retAt)}`;

  return (
    <Tooltip title={tip}>
      <Chip size="small" label={status} sx={scanChipSx[status]} />
    </Tooltip>
  );
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
  const [deleting, setDeleting] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);
  const [lastDeleted, setLastDeleted] = useState([]);
  const selectedIds = useMemo(
    () =>
      Array.isArray(rowSelectionModel)
        ? rowSelectionModel.filter((id) => id != null).map((id) => String(id))
        : [],
    [rowSelectionModel],
  );
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [editingTicket, setEditingTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const undoTimerRef = useRef(null);
  const previewRef = useRef(null);
  const [noAccessAlertOpen, setNoAccessAlertOpen] = useState(false);
  const { user, authLoading, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const scannerFullScreen = useMediaQuery(theme.breakpoints.down("md"));
  const canGenerate = role === "admin";
  const canScanTickets = role === "admin" || role === "driver";
  const [scannerOpen, setScannerOpen] = useState(false);
  const [sequentialScan, setSequentialScan] = useState(true);

  const openScanner = useCallback(() => {
    setScannerOpen(true);
  }, []);

  const closeScanner = useCallback(() => {
    setScannerOpen(false);
  }, []);

  const handleSequentialToggle = useCallback((event) => {
    setSequentialScan(event.target.checked);
  }, []);

  useEffect(() => {
    if (scannerOpen) {
      setRowSelectionModel([]);
    }
  }, [scannerOpen]);

  const handleScanResult = useCallback(
    async ({ text }) => {
      const trimmed = String(text || "").trim();
      if (!trimmed) return;
      const withoutQuery = trimmed.split("?")[0];
      const segments = withoutQuery.split("/").filter(Boolean);
      const candidate = segments.length ? segments[segments.length - 1] : trimmed;
      const ticketId = String(candidate || "").trim();
      if (!ticketId) {
        setSnackbar({
          open: true,
          message: "Invalid ticket code",
          severity: "error",
          action: null,
        });
        return;
      }
      const localMatch = tickets.find(
        (t) => String(t.ticketId) === ticketId || String(t.id) === ticketId,
      );
      if (localMatch) {
        setPreviewTicket(localMatch);
        setSnackbar({
          open: true,
          message: `Ticket ${ticketId} ready`,
          severity: "success",
          action: null,
        });
        return;
      }
      try {
        const [match] = await snapshotTicketsByIds([ticketId]);
        if (match?.data) {
          const normalized = normalizeTicket(
            { id: match.id, ...(match.data || {}) },
            dayjs,
          );
          setPreviewTicket(normalized);
          setSnackbar({
            open: true,
            message: `Ticket ${normalized.ticketId} ready`,
            severity: "success",
            action: null,
          });
        } else {
          setSnackbar({
            open: true,
            message: `Ticket ${ticketId} not found`,
            severity: "warning",
            action: null,
          });
        }
      } catch (err) {
        logError(err, {
          area: "Tickets",
          action: "scanLookup",
          ticketId,
        });
        setSnackbar({
          open: true,
          message: "Failed to load ticket",
          severity: "error",
          action: null,
        });
      }
    },
    [tickets, setPreviewTicket, setSnackbar],
  );

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
    const unsubscribe = subscribeTickets({
      onData: (data) => {
        try {
          const rows = (data || []).map((d) => normalizeTicket(d, dayjs));
          setTickets(rows);
        } catch (e) {
          logError(e);
        }
        setLoading(false);
      },
      onError: (err) => {
        setError(err);
        setSnackbar({
          open: true,
          message: "Permissions issue loading tickets",
          severity: "error",
          action: null,
        });
        setLoading(false);
      },
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [authLoading, user?.email]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
    };
  }, []);

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

  const rows = useMemo(
    () => (Array.isArray(filteredTickets) ? filteredTickets : []),
    [filteredTickets],
  );

  const safeRows = Array.isArray(rows) ? rows : [];

  const [tzGuess] = useState(() => {
    try {
      return dayjs?.tz?.guess?.() || undefined;
    } catch (e) {
      logError(e);
      return undefined;
    }
  });

  const fmtPickup = useCallback(
    (row) => {
      const d = toDayjs(row?.pickupTime);
      if (d) {
        return tzGuess
          ? d.tz(tzGuess).format("MMM D, YYYY h:mm A")
          : d.format("MMM D, YYYY h:mm A");
      }
      if (row?.pickupDateStr || row?.pickupTimeStr) {
        return [row?.pickupDateStr, row?.pickupTimeStr]
          .filter(Boolean)
          .join(" ");
      }
      return "N/A";
    },
    [tzGuess],
  );

  const openLink = useCallback((href) => {
    if (!href) return;
    try {
      window.open(href, "_blank", "noopener,noreferrer");
    } catch (e) {
      logError(e);
    }
  }, []);

  const getRowId = useCallback((r) => {
    if (r?.id != null) return String(r.id);
    if (r?.ticketId != null) return String(r.ticketId);
    return null;
  }, []);

  const handleEditClick = useCallback((row) => setEditingTicket(row), []);
  const handleEditClose = useCallback(() => setEditingTicket(null), []);

  const closeUndoSnackbar = useCallback((options = {}) => {
    const { clearDocs = false } = options;
    setUndoOpen(false);
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    if (clearDocs) {
      setLastDeleted([]);
    }
  }, []);

  const handleDeleteRows = useCallback(
    async (idsInput) => {
      const ids = Array.isArray(idsInput)
        ? Array.from(new Set(idsInput.filter((id) => id != null).map(String)))
        : [];
      if (!ids.length || deleting) return;

      setDeleting(true);
      let deletionSucceeded = false;
      try {
        const snapshot = await snapshotTicketsByIds(ids);
        setLastDeleted(snapshot);

        await deleteTicketsByIds(ids);
        deletionSucceeded = true;

        setUndoOpen(true);
        if (undoTimerRef.current) {
          clearTimeout(undoTimerRef.current);
        }
        undoTimerRef.current = setTimeout(() => {
          closeUndoSnackbar({ clearDocs: true });
        }, 6000);
      } catch (err) {
        logError(err, {
          area: "tickets",
          action: "handleDeleteRows",
          ids,
        });
        setLastDeleted([]);
        setSnackbar({
          open: true,
          message:
            err?.code === "permission-denied"
              ? "You don't have permission to delete tickets."
              : "Delete failed.",
          severity: "error",
          action: null,
        });
      } finally {
        setDeleting(false);
        if (deletionSucceeded) {
          setRowSelectionModel((prev) => {
            const base = Array.isArray(prev) ? prev.map(String) : [];
            const deleteSet = new Set(ids.map(String));
            return base.filter((id) => !deleteSet.has(id));
          });
        }
      }
    },
    [deleting, closeUndoSnackbar],
  );

  const handleUndoDelete = useCallback(async () => {
    if (!lastDeleted?.length) {
      closeUndoSnackbar();
      return;
    }

    closeUndoSnackbar();
    try {
      await restoreTickets(lastDeleted);
      const count = lastDeleted.length;
      setSnackbar({
        open: true,
        message: `Restored ${count} ticket${count === 1 ? "" : "s"}.`,
        severity: "success",
        action: null,
      });
    } catch (err) {
      logError(err, {
        area: "tickets",
        action: "handleUndoDelete",
        count: lastDeleted.length,
      });
      setSnackbar({
        open: true,
        message: "Undo failed. Please refresh and try again.",
        severity: "error",
        action: null,
      });
    } finally {
      setLastDeleted([]);
    }
  }, [closeUndoSnackbar, lastDeleted]);

  const handleDeleteClick = useCallback(
    (row) => {
      const docId = row?.id != null ? String(row.id) : null;
      if (!docId) {
        setSnackbar({
          open: true,
          message: "Missing document id for delete.",
          severity: "warning",
          action: null,
        });
        return;
      }
      handleDeleteRows([docId]);
    },
    [handleDeleteRows],
  );

  const columns = useMemo(
    () =>
      withSafeColumns([
        {
          field: "ticketId",
          headerName: "Ticket ID",
          minWidth: 140,
          renderCell: (p) => p?.row?.ticketId ?? p?.row?.id ?? "N/A",
        },
        {
          field: "passenger",
          headerName: "Passenger",
          minWidth: 180,
          renderCell: (p) => p?.row?.passenger ?? "N/A",
        },
        {
          field: "pickup",
          headerName: "Pickup",
          minWidth: 220,
          renderCell: (p) => p?.row?.pickup ?? "N/A",
        },
        {
          field: "dropoff",
          headerName: "Dropoff",
          minWidth: 220,
          renderCell: (p) => p?.row?.dropoff ?? "N/A",
        },
        {
          field: "pickupTime",
          headerName: "Pickup Time",
          minWidth: 200,
          renderCell: (p) => fmtPickup(p?.row || {}),
        },
        {
          field: "passengerCount",
          headerName: "Count",
          minWidth: 90,
          renderCell: (p) =>
            p?.row?.passengerCount ?? p?.row?.passengercount ?? "N/A",
        },
        {
          field: "scanStatus",
          headerName: "Scan Status",
          minWidth: 140,
          sortable: false,
          renderCell: ScanStatusCell,
        },
        {
          field: "link",
          headerName: "Link",
          minWidth: 120,
          sortable: false,
          renderCell: (p) => {
            const href = p?.row?.linkUrl;
            if (!href) return "—";
            return (
              <Box
                component="span"
                role="button"
                tabIndex={0}
                sx={{ textDecoration: "underline", cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  openLink(href);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    openLink(href);
                  }
                }}
              >
                Open
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
              disabled={deleting}
              onClick={() => handleDeleteClick(params.row)}
            />,
          ],
        },
      ]),
    [fmtPickup, handleDeleteClick, handleEditClick, openLink, deleting],
  );

  useGridDoctor({ name: "Tickets", rows: safeRows, columns });

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
    const selectionSet = new Set(selectedIds);
    const selected = rows.filter((r) => selectionSet.has(String(r?.id ?? "")));
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
    selectedIds,
    theme.palette.background.paper,
    theme.palette.text.primary,
  ]);

  if (Array.isArray(safeRows) && safeRows.length) {
    const k = Object.keys(safeRows[0] || {});
    console.log("[Tickets:keys]", k);
  }

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

        <Tooltip
          title={
            selectedIds.length
              ? "Delete selected tickets"
              : "Select tickets to enable"
          }
        >
          <span>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              disabled={!selectedIds.length || deleting}
              onClick={() => handleDeleteRows(selectedIds)}
            >
              Delete Selected
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
            rows={safeRows}
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
            slotProps={{
              toolbar: {
                showQuickFilter: true,
                quickFilterProps: { debounceMs: 300 },
              },
            }}
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

      {canScanTickets && (
        <>
          <Dialog
            open={scannerOpen}
            onClose={closeScanner}
            fullScreen={scannerFullScreen}
            maxWidth="md"
            fullWidth
            aria-labelledby="ticket-scanner-title"
            PaperProps={{
              sx: {
                bgcolor: "#060606",
                color: "#f5f5f5",
                ...(scannerFullScreen
                  ? {}
                  : {
                      borderRadius: 2,
                      maxWidth: "min(760px, 96vw)",
                      width: "min(760px, 96vw)",
                    }),
              },
            }}
          >
            <AppBar
              position="relative"
              sx={{
                bgcolor: "#060606",
                color: "#fff",
                boxShadow: "none",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <Toolbar sx={{ gap: 2 }}>
                <Typography
                  id="ticket-scanner-title"
                  variant="h6"
                  component="div"
                  sx={{ flexGrow: 1, fontWeight: 600 }}
                >
                  Scan Tickets
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={sequentialScan}
                      onChange={handleSequentialToggle}
                      color="success"
                      inputProps={{ "aria-label": "Toggle sequential scanning" }}
                    />
                  }
                  label="Sequential mode"
                  sx={{
                    color: "rgba(255,255,255,0.8)",
                    "& .MuiFormControlLabel-label": {
                      fontSize: 14,
                    },
                  }}
                />
                <IconButton
                  edge="end"
                  onClick={closeScanner}
                  aria-label="Close ticket scanner"
                  sx={{ color: "#f5f5f5" }}
                >
                  <CloseIcon />
                </IconButton>
              </Toolbar>
            </AppBar>
            <Box sx={{ p: { xs: 2, sm: 3 }, bgcolor: "#060606" }}>
              <Suspense
                fallback={
                  <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
                    <CircularProgress size={24} sx={{ color: "#4cbb17" }} />
                  </Box>
                }
              >
                {scannerOpen && (
                  <TicketScanner
                    onScan={handleScanResult}
                    onClose={closeScanner}
                    sequential={sequentialScan}
                  />
                )}
              </Suspense>
            </Box>
          </Dialog>

          <Tooltip title="Scan tickets">
            <Fab
              color="primary"
              aria-label="Open ticket scanner"
              onClick={openScanner}
              sx={{
                position: "fixed",
                right: 16,
                bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
                bgcolor: "#4cbb17",
                color: "#060606",
                display: scannerOpen ? "none" : "inline-flex",
                "&:hover": { bgcolor: "#43a414" },
                zIndex: (t) => t.zIndex.modal + 1,
              }}
            >
              <QrCodeScannerIcon />
            </Fab>
          </Tooltip>
        </>
      )}

      <Snackbar
        open={undoOpen}
        autoHideDuration={6000}
        onClose={(_, reason) => {
          if (reason === "clickaway") return;
          closeUndoSnackbar({ clearDocs: true });
        }}
        message={`Deleted ${lastDeleted?.length || 0} ticket${
          (lastDeleted?.length || 0) === 1 ? "" : "s"
        }.`}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        action={
          <Button
            onClick={handleUndoDelete}
            size="small"
            sx={{ color: "#4cbb17" }}
            aria-label="Undo delete"
          >
            Undo
          </Button>
        }
      />

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
