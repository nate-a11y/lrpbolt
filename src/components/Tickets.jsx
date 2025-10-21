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
import * as htmlToImage from "html-to-image";
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
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
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
  Stack,
} from "@mui/material";
import { GridActionsCellItem } from "@mui/x-data-grid-pro";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EmailIcon from "@mui/icons-material/Email";
import EditIcon from "@mui/icons-material/Edit";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import CloseIcon from "@mui/icons-material/Close";
import { motion } from "framer-motion";

import { formatDateTime, dayjs, toDayjs } from "@/utils/time";
import { getScanStatus, getScanMeta } from "@/utils/ticketMap";
import {
  subscribeTickets,
  deleteTicketsBatch,
  restoreTicketsBatch,
  getTicketById,
} from "@/services/fs";
import LrpDataGridPro from "@/components/datagrid/LrpDataGridPro";
import { exportTicketNodesAsZip } from "@/utils/exportTickets";
import { sendTicketsEmail } from "@/services/emailTickets";
import { getFlag } from "@/services/observability";
import ErrorBoundary from "@/components/feedback/ErrorBoundary.jsx";
import LoadingButtonLite from "@/components/inputs/LoadingButtonLite.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import { vibrateOk, vibrateWarn } from "@/utils/haptics.js";
import { playBeep } from "@/utils/sound.js";

import logError from "../utils/logError.js";
import { useAuth } from "../context/AuthContext.jsx";
import { withSafeColumns } from "../utils/gridFormatters";
import { useGridDoctor } from "../utils/useGridDoctor";
import { updateTicketScan } from "../hooks/api";

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
    color: (t) => t.palette.primary.main,
    border: "1px solid rgba(76,187,23,0.35)",
  },
  Outbound: {
    bgcolor: "rgba(76,187,23,0.12)",
    color: (t) => t.palette.primary.main,
    border: "1px solid rgba(76,187,23,0.25)",
  },
  Return: {
    bgcolor: "action.selected",
    color: "text.primary",
  },
  Unscanned: {
    bgcolor: "rgba(255,255,255,0.08)",
    color: "text.secondary",
    border: (t) => `1px solid ${t.palette.divider}`,
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

function TicketPreviewCard({ ticket }) {
  if (!ticket) return null;
  const status = getScanStatus(ticket);
  const meta = getScanMeta(ticket);
  return (
    <Box
      sx={{
        p: 2,
        width: 360,
        bgcolor: (theme) => theme.palette.background.paper,
        borderRadius: 2,
        color: (theme) => theme.palette.text.primary,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        boxShadow: "0 0 0 1px rgba(76,187,23,0.28)",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <Box
          component="img"
          src="/android-chrome-512x512.png"
          alt="Lake Ride Pros"
          sx={{ height: 48, width: 48, objectFit: "contain" }}
        />
      </Box>
      <Typography variant="h6" align="center" fontWeight={600}>
        🎟️ Shuttle Ticket
      </Typography>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />
      <Stack spacing={0.5}>
        <Typography>
          <strong>Passenger:</strong> {ticket.passenger || "N/A"}
        </Typography>
        <Typography>
          <strong>Passenger Count:</strong> {ticket.passengerCount ?? "N/A"}
        </Typography>
        <Typography>
          <strong>Date:</strong> {formatDate(ticket.pickupTime)}
        </Typography>
        <Typography>
          <strong>Time:</strong> {formatTime(ticket.pickupTime)}
        </Typography>
        <Typography>
          <strong>Pickup:</strong> {ticket.pickup || "N/A"}
        </Typography>
        <Typography>
          <strong>Dropoff:</strong> {ticket.dropoff || "N/A"}
        </Typography>
        {ticket.notes ? (
          <Typography>
            <strong>Notes:</strong> {ticket.notes}
          </Typography>
        ) : null}
        <Typography>
          <strong>Ticket ID:</strong> {ticket.ticketId || ticket.id || "N/A"}
        </Typography>
      </Stack>
      <Stack spacing={0.5}>
        <Typography display="flex" alignItems="center" gap={1}>
          <strong>Status:</strong>
          <ScanStatusCell row={ticket} />
        </Typography>
        {status !== "Unscanned" && meta ? (
          <>
            {meta.outAt ? (
              <Typography>
                <strong>Outbound:</strong> {formatDateTime(meta.outAt) || "N/A"}
                {meta.outBy ? ` by ${meta.outBy}` : ""}
              </Typography>
            ) : null}
            {meta.retAt ? (
              <Typography>
                <strong>Return:</strong> {formatDateTime(meta.retAt) || "N/A"}
                {meta.retBy ? ` by ${meta.retBy}` : ""}
              </Typography>
            ) : null}
          </>
        ) : null}
      </Stack>
      <Box sx={{ mt: 1.5, display: "flex", justifyContent: "center" }}>
        <QRCode
          value={`https://lakeridepros.xyz/ticket/${ticket.ticketId || ""}`}
          size={160}
        />
      </Box>
    </Box>
  );
}

function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [filteredDate, setFilteredDate] = useState("All Dates");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewTicket, setPreviewTicket] = useState(null);
  const [rowSelectionModel, setRowSelectionModel] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const selectedIds = useMemo(
    () =>
      Array.isArray(rowSelectionModel)
        ? rowSelectionModel.filter((id) => id != null).map((id) => String(id))
        : [],
    [rowSelectionModel],
  );
  const [tab, setTab] = useState(0);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState(
    "Your Tickets from Lake Ride Pros",
  );
  const [emailMessage, setEmailMessage] = useState(
    "Attached are your tickets. It’s more than a ride, it’s memories made.",
  );
  const [editingTicket, setEditingTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const undoTimerRef = useRef(null);
  const previewRef = useRef(null);
  const ticketPreviewContainerRef = useRef(null);
  const rawTicketsRef = useRef(new Map());
  const deletedRowsRef = useRef([]);
  const [noAccessAlertOpen, setNoAccessAlertOpen] = useState(false);
  const { user, authLoading, role } = useAuth();
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const scannerFullScreen = useMediaQuery(theme.breakpoints.down("md"));
  const canGenerate = role === "admin";
  const canScanTickets = role === "admin" || role === "driver";
  const [scannerOpen, setScannerOpen] = useState(false);
  const [sequentialScan, setSequentialScan] = useState(true);
  const [pendingScanTicket, setPendingScanTicket] = useState(null);
  const [savingScan, setSavingScan] = useState(false);
  const [savingScanType, setSavingScanType] = useState(null);
  const [subscriptionKey, setSubscriptionKey] = useState(0);
  const [scannerInstanceKey, setScannerInstanceKey] = useState(0);
  const [scannerResumeSignal, setScannerResumeSignal] = useState(0);
  const [scanLookupLoading, setScanLookupLoading] = useState(false);
  const { show: showSnack } = useSnack();

  const announce = useCallback((message) => {
    if (typeof window === "undefined") return;
    window.__LRP_LIVE_MSG__ = message || "";
    try {
      window.dispatchEvent(
        new CustomEvent("lrp:live-region", { detail: message || "" }),
      );
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[Tickets] live region dispatch failed", error);
      }
    }
  }, []);

  const showSuccessSnack = useCallback(
    (message, options = {}) => {
      if (!message) return;
      vibrateOk();
      announce(message);
      showSnack(message, "success", options);
    },
    [announce, showSnack],
  );

  const showWarnOrErrorSnack = useCallback(
    (message, severity = "warning", options = {}) => {
      if (!message) return;
      vibrateWarn();
      announce(message);
      showSnack(message, severity, options);
    },
    [announce, showSnack],
  );

  const showInfoSnack = useCallback(
    (message, options = {}) => {
      if (!message) return;
      announce(message);
      showSnack(message, "info", options);
    },
    [announce, showSnack],
  );

  const resumeScanner = useCallback(
    () => setScannerResumeSignal((value) => value + 1),
    [],
  );

  const openScanner = useCallback(() => {
    setScannerOpen(true);
    setPendingScanTicket(null);
    setScanLookupLoading(false);
    setTimeout(resumeScanner, 0);
  }, [resumeScanner]);

  const closeScanner = useCallback(() => {
    setScannerOpen(false);
    setPendingScanTicket(null);
    setSavingScan(false);
    setSavingScanType(null);
    setScanLookupLoading(false);
    setScannerInstanceKey((k) => k + 1);
    resumeScanner();
  }, [resumeScanner]);

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
      const candidate = segments.length
        ? segments[segments.length - 1]
        : trimmed;
      const ticketId = String(candidate || "").trim();
      if (!ticketId) {
        showWarnOrErrorSnack("Invalid ticket code", "error");
        setPendingScanTicket(null);
        resumeScanner();
        return;
      }
      setScanLookupLoading(true);
      setPendingScanTicket({ ticketId, loading: true });
      setPreviewTicket(null);
      try {
        const match = await getTicketById(ticketId);
        if (!match) {
          showWarnOrErrorSnack(`Ticket ${ticketId} not found`, "error");
          setPendingScanTicket(null);
          resumeScanner();
          return;
        }
        const normalized = normalizeTicket(match, dayjs);
        setPreviewTicket(normalized);
        setPendingScanTicket(normalized);
        showSuccessSnack(
          `Ticket ${normalized.ticketId} ready — confirm scan direction`,
        );
      } catch (err) {
        logError(err, {
          area: "Shuttle Tickets",
          action: "scanLookup",
          ticketId,
        });
        showWarnOrErrorSnack("Failed to load ticket", "error");
        setPendingScanTicket(null);
        resumeScanner();
      } finally {
        setScanLookupLoading(false);
      }
    },
    [
      setPreviewTicket,
      setPendingScanTicket,
      showSuccessSnack,
      showWarnOrErrorSnack,
      resumeScanner,
    ],
  );

  const handleScanDialogClose = useCallback(() => {
    if (savingScan) return;
    setPendingScanTicket(null);
    setSavingScanType(null);
    setScanLookupLoading(false);
    resumeScanner();
  }, [resumeScanner, savingScan, setPendingScanTicket, setSavingScanType]);

  const handleScanConfirm = useCallback(
    async (scanType) => {
      if (!pendingScanTicket || savingScan) return;
      if (scanType !== "outbound" && scanType !== "return") return;
      const docId = pendingScanTicket.id || pendingScanTicket.ticketId;
      if (!docId) {
        showWarnOrErrorSnack("Ticket is missing an identifier", "error");
        return;
      }
      const label = pendingScanTicket.ticketId || String(docId);
      if (scanType === "outbound" && pendingScanTicket.scannedOutbound) {
        showInfoSnack(`Ticket ${label} already marked Outbound`);
        return;
      }
      if (scanType === "return" && pendingScanTicket.scannedReturn) {
        showInfoSnack(`Ticket ${label} already marked Return`);
        return;
      }
      const driver = user?.displayName || user?.email || user?.uid || "N/A";
      setSavingScan(true);
      setSavingScanType(scanType);
      try {
        const result = await updateTicketScan(docId, scanType, driver);
        if (!result?.success) {
          throw new Error("Scan update failed");
        }
        const now = dayjs();
        const updates =
          scanType === "outbound"
            ? {
                scannedOutbound: true,
                scannedOutboundAt: now,
                scannedOutboundBy: driver,
              }
            : {
                scannedReturn: true,
                scannedReturnAt: now,
                scannedReturnBy: driver,
              };
        const key = String(docId);
        setTickets((prev) =>
          Array.isArray(prev)
            ? prev.map((item) => {
                const matchId = String(item?.id ?? item?.ticketId ?? "");
                if (matchId !== key) return item;
                return { ...item, ...updates };
              })
            : prev,
        );
        setPreviewTicket((prev) => {
          if (!prev) return prev;
          const matchId = String(prev?.id ?? prev?.ticketId ?? "");
          if (matchId !== key) return prev;
          return { ...prev, ...updates };
        });
        const successMessage = `Ticket ${label} marked ${
          scanType === "outbound" ? "Outbound" : "Return"
        }`;
        showSuccessSnack(successMessage);
        try {
          playBeep();
        } catch (soundError) {
          logError(soundError, {
            area: "Shuttle Tickets",
            action: "scanConfirmSound",
            ticketId: docId,
          });
        }
        setPendingScanTicket(null);
        resumeScanner();
      } catch (err) {
        logError(err, {
          area: "Shuttle Tickets",
          action: "recordScan",
          scanType,
          ticketId: docId,
        });
        showWarnOrErrorSnack("Failed to record scan", "error");
      } finally {
        setSavingScan(false);
        setSavingScanType(null);
      }
    },
    [
      pendingScanTicket,
      savingScan,
      setTickets,
      setPreviewTicket,
      setPendingScanTicket,
      setSavingScanType,
      showInfoSnack,
      showSuccessSnack,
      showWarnOrErrorSnack,
      resumeScanner,
      user?.displayName,
      user?.email,
      user?.uid,
    ],
  );

  const pendingScanStatus = useMemo(
    () => (pendingScanTicket ? getScanStatus(pendingScanTicket) : "Unscanned"),
    [pendingScanTicket],
  );

  const pendingScanMeta = useMemo(
    () => (pendingScanTicket ? getScanMeta(pendingScanTicket) : null),
    [pendingScanTicket],
  );

  useEffect(() => {
    if (tab === 1 && !canGenerate) {
      setTab(0);
      setNoAccessAlertOpen(true);
    }
  }, [tab, canGenerate]);

  const handleTabChange = useCallback(
    (_, value) => {
      if (value === 1 && !canGenerate) {
        setNoAccessAlertOpen(true);
        return;
      }
      setTab(value);
    },
    [canGenerate],
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
          const incoming = Array.isArray(data) ? data : [];
          const map = new Map();
          incoming.forEach((item) => {
            if (!item) return;
            const id = item.id != null ? String(item.id) : null;
            if (!id) return;
            map.set(id, { ...item });
          });
          rawTicketsRef.current = map;
          const rows = incoming.map((d) => normalizeTicket(d, dayjs));
          setTickets(rows);
        } catch (e) {
          logError(e);
        }
        setLoading(false);
      },
      onError: (err) => {
        setError(err);
        showWarnOrErrorSnack("Permissions issue loading tickets", "error");
        setLoading(false);
      },
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [authLoading, user?.email, subscriptionKey, showWarnOrErrorSnack]);

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

  const rows = useMemo(
    () => (Array.isArray(filteredTickets) ? filteredTickets : []),
    [filteredTickets],
  );

  const safeRows = Array.isArray(rows) ? rows : [];

  useEffect(() => {
    if (!getFlag || !getFlag("grid.debug")) {
      return;
    }
    const sample = Array.isArray(rows) ? rows[0] : null;
    console.log("[GridDebug:Tickets] row0", sample);
  }, [rows]);

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

  const selectedRows = useMemo(() => {
    if (!selectedIds.length) return [];
    const map = new Map();
    rows.forEach((row) => {
      const key = getRowId(row);
      if (key != null) {
        map.set(String(key), row);
      }
    });
    return selectedIds
      .map((id) => map.get(String(id)))
      .filter((row) => Boolean(row));
  }, [rows, selectedIds, getRowId]);

  const renderTicketPreviewNode = useCallback((ticket) => {
    if (!ticket || !ticketPreviewContainerRef.current) return null;
    const wrapper = document.createElement("div");
    ticketPreviewContainerRef.current.appendChild(wrapper);
    const root = ReactDOM.createRoot(wrapper);
    root.render(<TicketPreviewCard ticket={ticket} />);
    wrapper.__lrpRoot = root;
    return wrapper;
  }, []);

  const handleEditClick = useCallback((row) => setEditingTicket(row), []);
  const handleEditClose = useCallback(() => setEditingTicket(null), []);

  const closeUndoSnackbar = useCallback((options = {}) => {
    const { clearDocs = false } = options;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    if (clearDocs) {
      deletedRowsRef.current = [];
    }
  }, []);

  const handleUndoDelete = useCallback(async () => {
    const cached = deletedRowsRef.current;
    if (!cached?.length) {
      closeUndoSnackbar({ clearDocs: true });
      return;
    }

    closeUndoSnackbar();
    try {
      await restoreTicketsBatch(cached);
      const count = cached.length;
      const successMessage = `Restored ${count} ticket${count === 1 ? "" : "s"}.`;
      showSuccessSnack(successMessage);
    } catch (err) {
      logError(err, {
        area: "tickets",
        action: "handleUndoDelete",
        count: cached.length,
      });
      showWarnOrErrorSnack(
        "Undo failed. Please refresh and try again.",
        "error",
      );
      setSubscriptionKey((key) => key + 1);
    } finally {
      deletedRowsRef.current = [];
    }
  }, [
    closeUndoSnackbar,
    showSuccessSnack,
    showWarnOrErrorSnack,
    setSubscriptionKey,
  ]);

  const handleDeleteRows = useCallback(
    async (idsInput) => {
      const ids = Array.isArray(idsInput)
        ? Array.from(new Set(idsInput.filter((id) => id != null).map(String)))
        : [];
      if (!ids.length || deleting) return;

      closeUndoSnackbar({ clearDocs: true });
      setDeleting(true);
      let deletionSucceeded = false;
      try {
        const captured = ids
          .map((id) => {
            const raw = rawTicketsRef.current.get(id);
            if (!raw) return null;
            const { id: rawId, ...data } = raw;
            return { id: rawId || id, ...data };
          })
          .filter(Boolean);
        deletedRowsRef.current = captured;
        if (captured.length < ids.length) {
          logError(new Error("Incomplete ticket snapshot before delete"), {
            area: "tickets",
            action: "captureDelete",
            ids,
            captured: captured.length,
          });
        }

        await deleteTicketsBatch(ids);
        deletionSucceeded = true;

        if (deletedRowsRef.current.length) {
          const count = deletedRowsRef.current.length;
          if (undoTimerRef.current) {
            clearTimeout(undoTimerRef.current);
          }
          const undoMessage = `Deleted ${count} ticket${count === 1 ? "" : "s"}.`;
          showInfoSnack(undoMessage, {
            autoHideDuration: 6000,
            action: (
              <Button
                onClick={handleUndoDelete}
                size="small"
                sx={{ color: (t) => t.palette.primary.main }}
                aria-label="Undo delete"
              >
                Undo
              </Button>
            ),
          });
          undoTimerRef.current = setTimeout(() => {
            closeUndoSnackbar({ clearDocs: true });
          }, 6000);
        }
      } catch (err) {
        logError(err, {
          area: "tickets",
          action: "handleDeleteRows",
          ids,
        });
        deletedRowsRef.current = [];
        showWarnOrErrorSnack(
          err?.code === "permission-denied"
            ? "You don't have permission to delete tickets."
            : "Delete failed.",
          "error",
        );
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
    [
      deleting,
      closeUndoSnackbar,
      handleUndoDelete,
      showInfoSnack,
      showWarnOrErrorSnack,
    ],
  );

  const handleDeleteClick = useCallback(
    (row) => {
      const docId = row?.id != null ? String(row.id) : null;
      if (!docId) {
        showWarnOrErrorSnack("Missing document id for delete.", "warning");
        return;
      }
      handleDeleteRows([docId]);
    },
    [handleDeleteRows, showWarnOrErrorSnack],
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
          naFallback: true,
          valueGetter: (params) => getScanStatus(params?.row || {}) || "N/A",
          renderCell: ScanStatusCell,
        },
        {
          field: "link",
          headerName: "Link",
          minWidth: 120,
          sortable: false,
          valueGetter: (params) => params?.row?.linkUrl || "N/A",
          renderCell: (p) => {
            const href = p?.row?.linkUrl;
            if (!href) return "N/A";
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
                const candidateId =
                  getRowId(params.row) ||
                  (params.row?.ticketId != null
                    ? String(params.row.ticketId)
                    : null);
                if (candidateId) {
                  setRowSelectionModel([String(candidateId)]);
                }
                setEmailTo(params.row?.email || emailTo);
                setEmailOpen(true);
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
    [
      deleting,
      emailTo,
      fmtPickup,
      getRowId,
      handleDeleteClick,
      handleEditClick,
      openLink,
      setEmailOpen,
      setEmailTo,
      setRowSelectionModel,
    ],
  );

  useGridDoctor({ name: "Shuttle Tickets", rows: safeRows, columns });

  const downloadTicket = useCallback(async () => {
    const node = previewRef.current;
    const t = previewTicket;
    if (!node || !t) return;
    try {
      const dataUrl = await htmlToImage.toPng(node, {
        pixelRatio: 2,
        backgroundColor: theme.palette.background.paper,
      });
      const link = document.createElement("a");
      link.download = `${t.ticketId}.png`;
      link.href = dataUrl;
      link.click();
      showSuccessSnack("Ticket saved as image");
    } catch (err) {
      logError(err, { area: "tickets", action: "downloadTicket" });
      showWarnOrErrorSnack("Failed to generate image", "error");
    }
  }, [
    previewTicket,
    theme.palette.background.paper,
    showSuccessSnack,
    showWarnOrErrorSnack,
  ]);

  const handleEmailSelected = useCallback(async () => {
    if (!selectedRows.length) return;
    if (!emailTo) {
      showWarnOrErrorSnack("Email address required", "warning");
      return;
    }
    if (!ticketPreviewContainerRef.current) return;
    setEmailSending(true);
    const nodes = [];
    try {
      selectedRows.forEach((ticket, index) => {
        const node = renderTicketPreviewNode(ticket);
        if (!node) return;
        const name = ticket?.ticketId || ticket?.id || `ticket-${index + 1}`;
        node.dataset.ticketName = String(name);
        nodes.push(node);
      });
      const files = [];
      for (let i = 0; i < nodes.length; i += 1) {
        const dataUrl = await htmlToImage.toPng(nodes[i], { pixelRatio: 2 });
        const filename = `${nodes[i].dataset.ticketName}.png`;
        files.push({ filename, dataUrl });
      }
      if (!files.length) return;
      try {
        await sendTicketsEmail({
          to: emailTo,
          subject: emailSubject,
          message: emailMessage,
          attachments: files,
        });
        showSuccessSnack("Tickets emailed");
      } catch (err) {
        logError(err, { area: "tickets", action: "emailSelected" });
        const zipFiles = files.map((file) => ({
          name: file.filename.replace(/\.png$/i, ""),
          dataUrl: file.dataUrl,
        }));
        const { downloadZipFromPngs } = await import("@/utils/exportTickets");
        await downloadZipFromPngs(zipFiles, `tickets-${Date.now()}.zip`);
        showInfoSnack("Endpoint unavailable — ZIP downloaded");
      }
    } catch (err) {
      logError(err, { area: "tickets", action: "emailSelected:generate" });
      showWarnOrErrorSnack("Failed to prepare tickets", "error");
    } finally {
      nodes.forEach((node) => {
        if (node?.__lrpRoot) {
          try {
            node.__lrpRoot.unmount();
          } catch (error) {
            logError(error, { area: "tickets", action: "emailCleanup" });
          }
        }
      });
      if (ticketPreviewContainerRef.current) {
        ticketPreviewContainerRef.current.innerHTML = "";
      }
      setEmailSending(false);
      setEmailOpen(false);
    }
  }, [
    emailMessage,
    emailSubject,
    emailTo,
    renderTicketPreviewNode,
    selectedRows,
    showInfoSnack,
    showSuccessSnack,
    showWarnOrErrorSnack,
  ]);

  const handleExportSelected = useCallback(async () => {
    if (!selectedRows.length) return;
    if (!ticketPreviewContainerRef.current) return;
    setExporting(true);
    const nodes = [];
    try {
      selectedRows.forEach((ticket, index) => {
        const node = renderTicketPreviewNode(ticket);
        if (!node) return;
        const name = ticket?.ticketId || ticket?.id || `ticket-${index + 1}`;
        node.dataset.ticketName = String(name);
        nodes.push(node);
      });
      if (!nodes.length) return;
      await exportTicketNodesAsZip(nodes, {
        zipName: `tickets-${Date.now()}.zip`,
      });
      showSuccessSnack("Tickets exported");
    } catch (err) {
      logError(err, { area: "tickets", action: "exportSelected" });
      showWarnOrErrorSnack("Failed to export tickets", "error");
    } finally {
      nodes.forEach((node) => {
        if (node?.__lrpRoot) {
          try {
            node.__lrpRoot.unmount();
          } catch (error) {
            logError(error, { area: "tickets", action: "exportCleanup" });
          }
        }
      });
      if (ticketPreviewContainerRef.current) {
        ticketPreviewContainerRef.current.innerHTML = "";
      }
      setExporting(false);
    }
  }, [
    renderTicketPreviewNode,
    selectedRows,
    showSuccessSnack,
    showWarnOrErrorSnack,
  ]);

  return (
    <ErrorBoundary>
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
        </Box>

        {noAccessAlertOpen && (
          <Alert severity="warning" onClose={closeNoAccessAlert} sx={{ mb: 2 }}>
            You don’t have access to Generate Ticket.
          </Alert>
        )}

        <Tabs
          value={tab}
          onChange={handleTabChange}
          sx={{
            mb: 2,
            "& .MuiTabs-indicator": {
              backgroundColor: (t) => t.palette.primary.main,
            },
          }}
        >
          <Tab label="Manage" {...getTabProps(0)} />
          <Tab label="Generate" disabled={!canGenerate} {...getTabProps(1)} />
        </Tabs>

        <TabPanel value={tab} tabKey={0}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ mb: 2, flexWrap: "wrap", alignItems: "center" }}
          >
            <Tooltip
              title={
                selectedRows.length
                  ? "Export selected as PNG (ZIP)"
                  : "Select tickets to enable"
              }
            >
              <span>
                <LoadingButtonLite
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleExportSelected}
                  disabled={!selectedRows.length}
                  loading={exporting}
                  loadingText="Exporting…"
                >
                  Export
                </LoadingButtonLite>
              </span>
            </Tooltip>
            <Tooltip
              title={
                selectedRows.length
                  ? "Email selected tickets"
                  : "Select tickets to enable"
              }
            >
              <span>
                <LoadingButtonLite
                  variant="outlined"
                  startIcon={<EmailIcon />}
                  onClick={() => setEmailOpen(true)}
                  disabled={!selectedRows.length || emailSending}
                  loading={emailSending}
                  loadingText="Sending…"
                >
                  Email
                </LoadingButtonLite>
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
                <LoadingButtonLite
                  variant="contained"
                  color="error"
                  startIcon={<DeleteIcon />}
                  disabled={!selectedIds.length}
                  loading={deleting}
                  loadingText="Deleting…"
                  onClick={() => handleDeleteRows(selectedIds)}
                >
                  Delete
                </LoadingButtonLite>
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
          </Stack>
          <Paper sx={{ width: "100%" }}>
            <LrpDataGridPro
              id="tickets-grid"
              rows={safeRows}
              columns={columns}
              getRowId={(row) =>
                getRowId(row) || (row?.ticketId ? String(row.ticketId) : null)
              }
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
                  quickFilterPlaceholder: "Search tickets",
                },
              }}
              density="compact"
              autoHeight={false}
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

        <TabPanel value={tab} tabKey={1}>
          {canGenerate ? (
            <Suspense
              fallback={
                <Box p={2}>
                  <CircularProgress size={20} />
                </Box>
              }
            >
              <TicketGenerator />
            </Suspense>
          ) : (
            <Alert severity="info">Ticket generation restricted.</Alert>
          )}
        </TabPanel>

        <Box
          ref={ticketPreviewContainerRef}
          sx={{
            position: "fixed",
            left: -9999,
            top: -9999,
            width: 0,
            height: 0,
          }}
        />

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
                  <TicketPreviewCard ticket={previewTicket} />
                </Box>

                <Box mt={3} display="flex" justifyContent="space-between">
                  <Button
                    variant="outlined"
                    color="info"
                    startIcon={<EmailIcon />}
                    onClick={() => {
                      const candidateId =
                        getRowId(previewTicket) ||
                        (previewTicket?.ticketId != null
                          ? String(previewTicket.ticketId)
                          : null);
                      if (candidateId) {
                        setRowSelectionModel([String(candidateId)]);
                      }
                      setEmailOpen(true);
                      setEmailTo(previewTicket?.email || emailTo);
                    }}
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

        <Dialog
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Email Selected Tickets</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <TextField
                label="To"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="customer@example.com"
              />
              <TextField
                label="Subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
              <TextField
                label="Message"
                multiline
                minRows={3}
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEmailOpen(false)}>Cancel</Button>
            <LoadingButtonLite
              variant="contained"
              onClick={handleEmailSelected}
              disabled={!selectedRows.length}
              loading={emailSending}
              loadingText="Sending…"
            >
              Send
            </LoadingButtonLite>
          </DialogActions>
        </Dialog>

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
                  bgcolor: (t) => t.palette.background.paper,
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
                  bgcolor: (t) => t.palette.background.paper,
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
                        inputProps={{
                          "aria-label": "Toggle sequential scanning",
                        }}
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
              <Box
                sx={{
                  p: { xs: 2, sm: 3 },
                  bgcolor: (t) => t.palette.background.paper,
                }}
              >
                <Suspense
                  fallback={
                    <Box
                      sx={{ py: 6, display: "flex", justifyContent: "center" }}
                    >
                      <CircularProgress
                        size={24}
                        sx={{ color: (t) => t.palette.primary.main }}
                      />
                    </Box>
                  }
                >
                  {scannerOpen && (
                    <TicketScanner
                      key={scannerInstanceKey}
                      onScan={handleScanResult}
                      onClose={closeScanner}
                      sequential={sequentialScan}
                      resumeSignal={scannerResumeSignal}
                    />
                  )}
                </Suspense>
              </Box>
            </Dialog>

            <Tooltip title="Scan Ticket">
              <Fab
                color="primary"
                aria-label="Scan Ticket"
                onClick={openScanner}
                sx={{
                  position: "fixed",
                  right: 16,
                  bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
                  bgcolor: (t) => t.palette.primary.main,
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

        <Dialog
          open={Boolean(pendingScanTicket)}
          onClose={handleScanDialogClose}
          aria-labelledby="tickets-scan-confirm"
          PaperProps={{
            sx: {
              bgcolor: (t) => t.palette.background.paper,
              color: "#f5f5f5",
              borderRadius: 2,
              width: "min(420px, 90vw)",
            },
          }}
        >
          <DialogTitle
            id="tickets-scan-confirm"
            sx={{
              fontWeight: 600,
              pb: 1,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Record ticket scan
          </DialogTitle>
          <DialogContent
            sx={{ bgcolor: (t) => t.palette.background.paper, pt: 3 }}
          >
            {scanLookupLoading ? (
              <Stack
                spacing={2}
                alignItems="center"
                justifyContent="center"
                sx={{ py: 4 }}
              >
                <CircularProgress
                  size={28}
                  sx={{ color: (t) => t.palette.primary.main }}
                />
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.72)" }}
                >
                  Fetching the latest ticket details…
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Ticket {pendingScanTicket?.ticketId || "—"}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.72)" }}
                >
                  Passenger: {pendingScanTicket?.passenger || "Unknown"}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.72)" }}
                >
                  Pickup: {pendingScanTicket?.pickup || "N/A"}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.72)" }}
                >
                  Date: {formatDate(pendingScanTicket?.pickupTime)} at{" "}
                  {formatTime(pendingScanTicket?.pickupTime)}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.72)" }}
                >
                  Current status: {pendingScanStatus}
                </Typography>
                {pendingScanMeta?.outAt && (
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(255,255,255,0.6)" }}
                  >
                    Outbound recorded by {pendingScanMeta.outBy || "Unknown"} at{" "}
                    {formatDateTime(pendingScanMeta.outAt)}
                  </Typography>
                )}
                {pendingScanMeta?.retAt && (
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(255,255,255,0.6)" }}
                  >
                    Return recorded by {pendingScanMeta.retBy || "Unknown"} at{" "}
                    {formatDateTime(pendingScanMeta.retAt)}
                  </Typography>
                )}
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.72)", pt: 0.5 }}
                >
                  Select a direction to log this scan.
                </Typography>
              </Stack>
            )}
          </DialogContent>
          <DialogActions
            sx={{
              bgcolor: (t) => t.palette.background.paper,
              px: 3,
              pb: 3,
              gap: 1,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <Button
              onClick={handleScanDialogClose}
              disabled={savingScan || scanLookupLoading}
              sx={{
                color: "#f5f5f5",
                "&.Mui-disabled": { color: "rgba(255,255,255,0.4)" },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleScanConfirm("outbound")}
              variant="outlined"
              color="info"
              disabled={savingScan || scanLookupLoading}
              startIcon={
                savingScan && savingScanType === "outbound" ? (
                  <CircularProgress size={16} sx={{ color: "inherit" }} />
                ) : null
              }
              sx={{
                fontWeight: 600,
                borderColor: "rgba(76,187,23,0.6)",
                color: "#f5f5f5",
                "&:hover": { borderColor: (t) => t.palette.primary.main },
                "&.Mui-disabled": {
                  borderColor: "rgba(255,255,255,0.24)",
                  color: "rgba(255,255,255,0.4)",
                },
              }}
            >
              {savingScan && savingScanType === "outbound"
                ? "Saving…"
                : "Mark Outbound"}
            </Button>
            <Button
              onClick={() => handleScanConfirm("return")}
              variant="contained"
              color="success"
              disabled={savingScan || scanLookupLoading}
              startIcon={
                savingScan && savingScanType === "return" ? (
                  <CircularProgress size={16} sx={{ color: "inherit" }} />
                ) : null
              }
              sx={{
                fontWeight: 700,
                boxShadow:
                  savingScan && savingScanType === "return"
                    ? "0 0 6px #4cbb17"
                    : "0 0 10px rgba(76,187,23,0.55)",
                "&:hover": { boxShadow: "0 0 12px rgba(76,187,23,0.75)" },
                "&.Mui-disabled": {
                  boxShadow: "none",
                  color: "rgba(255,255,255,0.4)",
                },
              }}
            >
              {savingScan && savingScanType === "return"
                ? "Saving…"
                : "Mark Return"}
            </Button>
          </DialogActions>
        </Dialog>
      </PageContainer>
    </ErrorBoundary>
  );
}

export default memo(Tickets);
