/* Proprietary and confidential. See LICENSE. */
// src/components/TicketScanner.jsx — BEYOND GOD MODE ⚡ DOM LOCK EDITION
import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { sanitize } from '../utils/sanitize';
import {
  Box, Typography, Paper, Snackbar, Alert, Modal, Divider, Button, Fade, CircularProgress, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import QRCode from 'react-qr-code';
import { Html5Qrcode } from 'html5-qrcode';
import { normalizeDate, normalizeTime, formatDate, formatTime } from '../timeUtils';
import { fetchTicket, updateTicketScan } from '../hooks/api';

export default function TicketScanner() {
  const [ticket, setTicket] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [cameraError, setCameraError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [currentCameraId, setCurrentCameraId] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [scanType, setScanType] = useState('outbound');

  const html5QrCodeRef = useRef(null);
  const qrContainerRef = useRef(null);
  const handleScanRef = useRef(null);
  const isScanningRef = useRef(false);
  const cooldownRef = useRef(null);
  const scannerReadyRef = useRef(false);
  const [confirming, setConfirming] = useState(false);

  const safeGetState = () => {
    try {
      return html5QrCodeRef.current?.getState?.();
    } catch {
      return null;
    }
  };

  // 🔍 Wait until QR container exists in DOM
  const waitForQrElement = async () => {
    for (let i = 0; i < 15; i++) {
      if (document.getElementById("qr-reader")) return true;
      await new Promise(r => setTimeout(r, 200));
    }
    return false;
  };

  // 🚀 Start scanner
  const initScanner = useCallback(async (cameraId = null) => {
    if (scannerReadyRef.current) return;
    const exists = await waitForQrElement();
    if (!exists) {
      console.error("❌ QR element not found after retries");
      setCameraError(true);
      return;
    }
    scannerReadyRef.current = true;

    if (!html5QrCodeRef.current) {
      html5QrCodeRef.current = new Html5Qrcode("qr-reader");
    }

    try {
      if (safeGetState() !== 2) {
        await html5QrCodeRef.current.start(
          cameraId || { facingMode: "environment" },
          { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.333 },
          text => handleScanRef.current?.(text)
        );
      }
    } catch (err) {
      console.error("Scanner start error:", err.message);
      setCameraError(true);
    }
  }, []);

  // 🎯 Fetch cameras first
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then(devices => {
        const rearCamera = devices.find(d => d.label.toLowerCase().includes('back')) || devices[0];
        setCameras(devices);
        setCurrentCameraId(rearCamera?.id || null);
      })
      .catch(() => setCameraError(true));
  }, []);

  // 🎬 Start scanner after DOM is painted
  useLayoutEffect(() => {
    if (currentCameraId) {
      initScanner(currentCameraId);
    }
    return () => {
      const scanner = html5QrCodeRef.current;
      if (scanner && (safeGetState() === 2 || safeGetState() === 3)) {
        scanner.stop().catch(() => {});
      }
    };
  }, [currentCameraId, initScanner]);

  const resetScanner = useCallback(() => {
    setTicket(null);
    setModalOpen(false);
    setShowSuccess(false);
    isScanningRef.current = false;
    setTimeout(() => {
      html5QrCodeRef.current?.resume?.().catch(() => {});
    }, 800);
  }, []);

  const handleScan = useCallback(async (text) => {
    const ticketId = text?.split("/").pop()?.trim();
    if (!ticketId || isScanningRef.current || cooldownRef.current === ticketId) return;
    isScanningRef.current = true;
    cooldownRef.current = ticketId;

    html5QrCodeRef.current?.pause?.().catch(() => {});
    setLoading(true);

    fetchTicket(ticketId)
      .then(data => {
        setLoading(false);
        if (data?.ticketId) {
          setTicket(data);
          setModalOpen(true);
          navigator.vibrate?.([100]);
          setTimeout(() => cooldownRef.current = null, 3000);
        } else {
          setSnackbar({ open: true, message: '❌ Ticket not found', severity: 'error' });
          resetScanner();
        }
      })
      .catch(() => {
        setLoading(false);
        setSnackbar({ open: true, message: '🚨 Failed to fetch ticket', severity: 'error' });
        resetScanner();
      });
  }, [resetScanner]);

  useEffect(() => {
    handleScanRef.current = handleScan;
  }, [handleScan]);

  const confirmTicket = async () => {
    if (!ticket || !scanType || confirming) return;
    setConfirming(true);
    const alreadyScanned = scanType === 'outbound' ? ticket.scannedoutbound : ticket.scannedreturn;

    if (alreadyScanned) {
      setSnackbar({ open: true, message: `⚠️ Ticket already scanned for ${scanType}`, severity: 'warning' });
      resetScanner();
      return;
    }

    const result = await updateTicketScan(ticket.ticketId, scanType, new Date().toISOString(), localStorage.getItem('lrp_driver') || 'Unknown');
    if (result.success) {
      setTicket(prev => ({
        ...prev,
        ...(scanType === 'outbound'
          ? { scannedoutbound: true, scannedoutboundby: localStorage.getItem('lrp_driver') || 'Unknown' }
          : { scannedreturn: true, scannedreturnby: localStorage.getItem('lrp_driver') || 'Unknown' })
      }));
      setShowSuccess(true);
      setSnackbar({ open: true, message: `✅ ${scanType} scanned!`, severity: 'success' });

      setTimeout(() => {
        setModalOpen(false);
        resetScanner();
      }, 300);
    } else {
      setSnackbar({ open: true, message: '❌ Failed to update scan', severity: 'error' });
      resetScanner();
    }
    setConfirming(false);
  };

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        🎯 Ticket Scanner
      </Typography>

      <ToggleButtonGroup value={scanType} exclusive onChange={(e, val) => val && setScanType(val)} fullWidth sx={{ mb: 2 }}>
        <ToggleButton value="outbound">⬅️ Outbound</ToggleButton>
        <ToggleButton value="return">➡️ Return</ToggleButton>
      </ToggleButtonGroup>

      {cameraError ? (
        <Alert severity="error">
          📵 Camera not ready. <Button onClick={() => window.location.reload()}>Reload</Button>
        </Alert>
      ) : (
        <Paper sx={{ p: 2, mb: 2 }} elevation={4}>
          <Box ref={qrContainerRef} id="qr-reader" sx={{ width: '100%', '& > video': { width: '100%', objectFit: 'cover' } }} />
        </Paper>
      )}

      {loading && <CircularProgress sx={{ display: 'block', mx: 'auto', mb: 2 }} />}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setTimeout(() => resetScanner(), 200); }}>
        <Box sx={{ backgroundColor: 'background.paper', borderRadius: 2, p: 4, width: 360, mx: 'auto', mt: '10vh' }}>
          {ticket ? (
            <>
              <Box display="flex" justifyContent="center" mb={2}>
                <QRCode value={`https://lakeridepros.xyz/ticket/${ticket.ticketId}`} size={120} />
              </Box>
              <Typography variant="h6" align="center">🎟️ {ticket.ticketId}</Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography><strong>Passenger:</strong> {sanitize(ticket.passenger)}</Typography>
              <Typography><strong>Passenger Count:</strong> {sanitize(ticket.passengercount)}</Typography>
              <Typography><strong>Date:</strong> {formatDate(ticket.date)}</Typography>
              <Typography><strong>Time:</strong> {formatTime(ticket.time)}</Typography>
              <Typography><strong>Pickup:</strong> {sanitize(ticket.pickup)}</Typography>
              <Typography><strong>Dropoff:</strong> {sanitize(ticket.dropoff)}</Typography>
              <Button fullWidth onClick={confirmTicket} sx={{ mt: 2 }} variant="contained">
                ✅ Confirm and Scan
              </Button>
            </>
          ) : <Typography align="center">Loading ticket…</Typography>}
        </Box>
      </Modal>

      <Fade in={showSuccess}>
        <Box sx={{ position: 'fixed', top: 0, width: '100vw', height: '100vh', bgcolor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Typography variant="h2" color="success.main">✅ Scanned</Typography>
        </Box>
      </Fade>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
