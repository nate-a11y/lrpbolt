/* Proprietary and confidential. See LICENSE. */
// src/components/TicketScanner.jsx — BEYOND GOD MODE ⚡ DOM LOCK EDITION
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  Box,
  Typography,
  Paper,
  Snackbar,
  Alert,
  Modal,
  Divider,
  Button,
  Fade,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Tooltip,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import FlashOffIcon from "@mui/icons-material/FlashOff";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ListAltIcon from "@mui/icons-material/ListAlt";
import { keyframes } from "@mui/system";
import { Link } from "react-router-dom";
import QRCode from "react-qr-code";
import { Html5Qrcode } from "html5-qrcode";

import { sanitize } from "../utils/sanitize";
import { fmtDateTime } from "../utils/timeUtils";
import { fetchTicket, updateTicketScan } from "../hooks/api";
import useAuth from "../hooks/useAuth.js";
import { logError } from "../utils/logError";

const formatDate = (v) => fmtDateTime(v, undefined, "MMM D, YYYY") || "—";

const formatTime = (v) => fmtDateTime(v, undefined, "h:mm A") || "—";

export default function TicketScanner() {
  const [ticket, setTicket] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [cameraError, setCameraError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentCameraId, setCurrentCameraId] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [scanType, setScanType] = useState("outbound");
  const [scanFeedback, setScanFeedback] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [cameraPaused, setCameraPaused] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  const html5QrCodeRef = useRef(null);
  const qrContainerRef = useRef(null);
  const handleScanRef = useRef(null);
  const isScanningRef = useRef(false);
  const cooldownRef = useRef(null);
  const scannerReadyRef = useRef(false);
  const [confirming, setConfirming] = useState(false);

  const { user } = useAuth();

  const shake = keyframes`
    10%, 90% { transform: translateX(-1px); }
    20%, 80% { transform: translateX(2px); }
    30%, 50%, 70% { transform: translateX(-4px); }
    40%, 60% { transform: translateX(4px); }
  `;

  const flash = keyframes`
    from { opacity: 0.7; }
    to { opacity: 0; }
  `;

  const safeGetState = () => {
    try {
      return html5QrCodeRef.current?.getState?.();
    } catch (err) {
      logError(err, "TicketScanner:getState");
      return null;
    }
  };

  // 🚀 Start scanner
  const initScanner = useCallback(async (cameraId = null) => {
    if (scannerReadyRef.current || !qrContainerRef.current) return;
    scannerReadyRef.current = true;

    if (!html5QrCodeRef.current) {
      html5QrCodeRef.current = new Html5Qrcode("qr-reader");
    }

    try {
      if (safeGetState() !== 2) {
        await html5QrCodeRef.current.start(
          cameraId || { facingMode: "environment" },
          { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.333 },
          (text) => handleScanRef.current?.(text),
        );
        const capabilities =
          html5QrCodeRef.current.getRunningTrackCapabilities?.();
        setTorchAvailable(!!capabilities?.torch);
      }
    } catch (err) {
      logError(err, "Scanner start error");
      setCameraError(true);
    }
  }, []);

  // 🎯 Fetch cameras first
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
    const devices = await Html5Qrcode.getCameras();
    if (!alive) return;
    const rearCamera =
      devices.find((d) => d.label.toLowerCase().includes("back")) ||
      devices[0];
    setCurrentCameraId(rearCamera?.id || null);
      } catch (err) {
        logError(err, "TicketScanner:getCameras");
        if (alive) setCameraError(true);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  // 🎬 Start scanner after DOM is painted
  useLayoutEffect(() => {
    if (currentCameraId) {
      initScanner(currentCameraId);
    }
    return () => {
      const scanner = html5QrCodeRef.current;
      if (scanner && (safeGetState() === 2 || safeGetState() === 3)) {
        scanner.stop().catch((err) => logError(err, "TicketScanner:stop"));
      }
    };
  }, [currentCameraId, initScanner]);

  const resetScanner = useCallback(() => {
    setTicket(null);
    setModalOpen(false);
    setShowSuccess(false);
    isScanningRef.current = false;
    setTimeout(() => {
      html5QrCodeRef.current
        ?.resume?.()
        .catch((err) => logError(err, "TicketScanner:resume"));
    }, 800);
    setCameraPaused(false);
  }, []);

  const toggleTorch = async () => {
    if (!torchAvailable) return;
    try {
      await html5QrCodeRef.current?.applyVideoConstraints({
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn((prev) => !prev);
      setSnackbar({
        open: true,
        message: !torchOn ? "🔦 Torch on" : "🔦 Torch off",
        severity: "info",
      });
    } catch (err) {
      logError(err, "TicketScanner:toggleTorch");
      setSnackbar({
        open: true,
        message: "❌ Torch not supported",
        severity: "error",
      });
    }
  };

  const toggleCamera = () => {
    const scanner = html5QrCodeRef.current;
    if (!scanner) return;
    if (cameraPaused) {
      scanner
        .resume()
        .then(() => {
          setCameraPaused(false);
          setSnackbar({
            open: true,
            message: "▶️ Camera resumed",
            severity: "info",
          });
        })
        .catch((err) => logError(err, "TicketScanner:toggleCamera"));
    } else {
      scanner
        .pause()
        .then(() => {
          setCameraPaused(true);
          setSnackbar({
            open: true,
            message: "⏸️ Camera paused",
            severity: "info",
          });
        })
        .catch((err) => logError(err, "TicketScanner:toggleCamera"));
    }
  };

  const handleScan = useCallback(
    async (text) => {
      const ticketId = text?.split("/").pop()?.trim();
      if (
        !ticketId ||
        isScanningRef.current ||
        cooldownRef.current?.id === ticketId
      )
        return;
      isScanningRef.current = true;
      cooldownRef.current = {
        id: ticketId,
        timer: setTimeout(() => {
          cooldownRef.current = null;
        }, 3000),
      };

      html5QrCodeRef.current
        ?.pause?.()
        .catch((err) => logError(err, "TicketScanner:pause"));
      setLoading(true);

      fetchTicket(ticketId)
        .then((data) => {
          setLoading(false);
          if (data?.ticketId) {
            setTicket(data);
            setModalOpen(true);
            navigator.vibrate?.([100]);
          } else {
            setScanFeedback("error");
            setTimeout(() => setScanFeedback(null), 600);
            setSnackbar({
              open: true,
              message: "❌ Ticket not found",
              severity: "error",
            });
            resetScanner();
          }
        })
        .catch((err) => {
          logError(err, "TicketScanner:fetchTicket");
          setLoading(false);
          setScanFeedback("error");
          setTimeout(() => setScanFeedback(null), 600);
          setSnackbar({
            open: true,
            message: "🚨 Failed to fetch ticket",
            severity: "error",
          });
          resetScanner();
        });
    },
    [resetScanner],
  );

  useEffect(() => {
    handleScanRef.current = handleScan;
  }, [handleScan]);

  useEffect(() => {
    return () => {
      if (cooldownRef.current?.timer) clearTimeout(cooldownRef.current.timer);
    };
  }, []);

  const confirmTicket = async () => {
    if (!ticket || !scanType || confirming) return;
    setConfirming(true);
    const alreadyScanned =
      scanType === "outbound" ? ticket.scannedOutbound : ticket.scannedReturn;

    if (alreadyScanned) {
      setSnackbar({
        open: true,
        message: `⚠️ Ticket already scanned for ${scanType}`,
        severity: "warning",
      });
      resetScanner();
      return;
    }

    const driver = user?.email || "Unknown";
    const result = await updateTicketScan(ticket.ticketId, scanType, driver);
    if (result.success) {
      setTicket((prev) => ({
        ...prev,
        ...(scanType === "outbound"
          ? {
              scannedOutbound: true,
              scannedOutboundBy: driver,
            }
          : {
              scannedReturn: true,
              scannedReturnBy: driver,
            }),
      }));
      setShowSuccess(true);
      setScanFeedback("success");
      setTimeout(() => setScanFeedback(null), 600);
      setLastScan({ ticketId: ticket.ticketId, passenger: ticket.passenger });
      setSnackbar({
        open: true,
        message: `✅ ${scanType} scanned!`,
        severity: "success",
      });

      setTimeout(() => {
        setModalOpen(false);
        resetScanner();
      }, 300);
    } else {
      setSnackbar({
        open: true,
        message: "❌ Failed to update scan",
        severity: "error",
      });
      resetScanner();
    }
    setConfirming(false);
  };

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", mt: 4 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        🎯 Ticket Scanner
      </Typography>

      <ToggleButtonGroup
        value={scanType}
        exclusive
        onChange={(e, val) => val && setScanType(val)}
        fullWidth
        color="primary"
        sx={{ mb: 2 }}
      >
        <ToggleButton value="outbound">
          <ArrowForwardIcon fontSize="small" sx={{ mr: 1 }} /> Outbound
        </ToggleButton>
        <ToggleButton value="return">
          <ArrowBackIcon fontSize="small" sx={{ mr: 1 }} /> Return
        </ToggleButton>
      </ToggleButtonGroup>

      {cameraError ? (
        <Alert severity="error">
          📵 Camera not ready.{" "}
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </Alert>
      ) : (
        <Paper
          sx={{ p: 2, mb: 2, display: "flex", justifyContent: "center" }}
          elevation={4}
        >
          <Box position="relative">
            <Box
              ref={qrContainerRef}
              id="qr-reader"
              sx={{
                width: 260,
                height: 260,
                borderRadius: 2,
                overflow: "hidden",
                border:
                  scanFeedback === "error"
                    ? "2px solid red"
                    : "2px solid transparent",
                animation:
                  scanFeedback === "error" ? `${shake} 0.4s` : undefined,
                "& > video": {
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                },
              }}
            />
            {scanFeedback === "success" && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 2,
                  bgcolor: "rgba(76,187,23,0.4)",
                  animation: `${flash} 0.6s ease-out`,
                }}
              />
            )}
          </Box>
        </Paper>
      )}

      <Box display="flex" justifyContent="center" gap={1} mb={2}>
        {torchAvailable && (
          <Tooltip title={torchOn ? "Torch off" : "Torch on"}>
            <IconButton color="primary" onClick={toggleTorch}>
              {torchOn ? <FlashOffIcon /> : <FlashOnIcon />}
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={cameraPaused ? "Resume camera" : "Pause camera"}>
          <IconButton color="primary" onClick={toggleCamera}>
            {cameraPaused ? <PlayArrowIcon /> : <PauseIcon />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Ticket Overview">
          <IconButton color="primary" component={Link} to="/tickets">
            <ListAltIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {lastScan && (
        <Typography variant="body2" align="center" sx={{ mb: 2 }}>
          Last scanned: {lastScan.ticketId} – {sanitize(lastScan.passenger)}
        </Typography>
      )}

      {loading && (
        <CircularProgress sx={{ display: "block", mx: "auto", mb: 2 }} />
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setTimeout(() => resetScanner(), 200);
        }}
      >
        <Box
          sx={{
            backgroundColor: "background.paper",
            borderRadius: 2,
            p: 4,
            width: 360,
            mx: "auto",
            mt: "10vh",
          }}
        >
          {ticket ? (
            <>
              <Box display="flex" justifyContent="center" mb={2}>
                <QRCode
                  value={`https://lakeridepros.xyz/ticket/${ticket.ticketId}`}
                  size={120}
                />
              </Box>
              <Typography variant="h6" align="center">
                🎟️ {ticket.ticketId}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography>
                <strong>Passenger:</strong> {sanitize(ticket.passenger)}
              </Typography>
              <Typography>
                <strong>Passenger Count:</strong>{" "}
                {sanitize(ticket.passengercount)}
              </Typography>
              <Typography>
                <strong>Date:</strong> {formatDate(ticket.date)}
              </Typography>
              <Typography>
                <strong>Time:</strong> {formatTime(ticket.time)}
              </Typography>
              <Typography>
                <strong>Pickup:</strong> {sanitize(ticket.pickup)}
              </Typography>
              <Typography>
                <strong>Dropoff:</strong> {sanitize(ticket.dropoff)}
              </Typography>
              <Button
                fullWidth
                onClick={confirmTicket}
                sx={{ mt: 2 }}
                variant="contained"
              >
                ✅ Confirm and Scan
              </Button>
            </>
          ) : (
            <Typography align="center">Loading ticket…</Typography>
          )}
        </Box>
      </Modal>

      <Fade in={showSuccess}>
        <Box
          sx={{
            position: "fixed",
            top: 0,
            width: "100vw",
            height: "100vh",
            bgcolor: "rgba(0,0,0,0.85)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Typography variant="h2" color="success.main">
            ✅ Scanned
          </Typography>
        </Box>
      </Fade>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
