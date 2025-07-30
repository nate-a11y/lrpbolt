/* Proprietary and confidential. See LICENSE. */
// src/components/TicketScanner.jsx — BEYOND GOD MODE ⚡ PATCHED
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Snackbar, Alert, Modal, Divider, Button, Fade, CircularProgress, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import QRCode from 'react-qr-code';
import { Html5Qrcode } from 'html5-qrcode';
import beepSound from '/src/assets/beep.mp3';
import { normalizeDate, normalizeTime, formatDate, formatTime } from '../timeUtils';
import { fetchTicket, updateTicketScan } from '../hooks/api';

export default function TicketScanner() {
  const [scannedData, setScannedData] = useState(null);
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
  const handleScanRef = useRef(null);
  const audioRef = useRef(null);
  const isScanningRef = useRef(false);
  const cooldownRef = useRef(null);
  const [confirming, setConfirming] = useState(false);

  const stopScanner = async () => {
    const scanner = html5QrCodeRef.current;
    if (scanner && scanner.getState && scanner.getState() === 2) {
      await scanner.stop().then(() => scanner.clear()).catch(() => {});
    }
  };

  const initScanner = useCallback(async (cameraId = null) => {
    const config = {
      fps: 15,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.333,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true }
    };
    const html5QrCode = new Html5Qrcode("qr-reader");
    html5QrCodeRef.current = html5QrCode;

    try {
      await html5QrCode.start(
        cameraId || { facingMode: "environment" },
        config,
        text => handleScanRef.current?.(text),
        () => {}
      );
    } catch (err) {
      if (cameras.length > 1) {
        const fallbackCam = cameras.find(c => c.id !== cameraId);
        if (fallbackCam) {
          setCurrentCameraId(fallbackCam.id);
          await html5QrCode.start(fallbackCam.id, config, text => handleScanRef.current?.(text), () => {});
        }
      }
      setCameraError(true);
    }

  }, [cameras]);


  useEffect(() => {
    Html5Qrcode.getCameras().then(devices => {
      const rearCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear')) || devices[0];
      setCameras(devices);
      setCurrentCameraId(rearCamera.id);
      initScanner(rearCamera.id).catch(console.error);
    }).catch(() => setCameraError(true));

    return () => { stopScanner(); };
  }, [initScanner]);
  
  const resetScanner = useCallback(() => {
    setScannedData(null);
    setTicket(null);
    setModalOpen(false);
    setShowSuccess(false);
    isScanningRef.current = false;
  
    setTimeout(() => {
      if (currentCameraId) {
        initScanner(currentCameraId);
      }
    }, 1200);
  }, [currentCameraId, initScanner]);
  
  const handleScan = useCallback(async (text) => {
    const ticketId = text?.split("/").pop()?.trim();
    if (!ticketId || isScanningRef.current || cooldownRef.current === ticketId) return;
  
    isScanningRef.current = true;
    cooldownRef.current = ticketId;
  
    await stopScanner();
    setScannedData(ticketId);
    setLoading(true);
  
    fetchTicket(ticketId)
      .then(data => {
        setLoading(false);
        if (data?.ticketId) {
          data.date = normalizeDate(data.date);
          data.time = normalizeTime(data.time);
          data.scannedOutbound = data.scannedoutbound === true || data.scannedoutbound === 'TRUE';
          data.scannedReturn = data.scannedreturn === true || data.scannedreturn === 'TRUE';
          data.scannedOutboundBy = data.scannedoutboundby;
          data.scannedReturnBy = data.scannedreturnby;
          setTicket(data);
          setModalOpen(true);

          audioRef.current?.play().catch(() => {}); // ✅ Safe beep
          navigator.vibrate?.([100]);
  
          setTimeout(() => {
            cooldownRef.current = null;
          }, 3000);
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

  const confirmTicket = () => {
    if (!ticket || !scanType || confirming) return;
    setConfirming(true);
  
    const alreadyScanned = scanType === 'outbound' ? ticket.scannedoutbound : ticket.scannedreturn;
    if (alreadyScanned) {
      setSnackbar({ open: true, message: `⚠️ Ticket already scanned for ${scanType}`, severity: 'warning' });
      resetScanner();
      return;
    }
  
    updateTicketScan(
      ticket.ticketId,
      scanType,
      new Date().toISOString(),
      localStorage.getItem('lrp_driver') || 'Unknown'
    )
      .then(result => {
        if (result.success) {
          const updatedFields = scanType === 'outbound'
            ? { scannedoutbound: true, scannedoutboundby: localStorage.getItem('lrp_driver') || 'Unknown' }
            : { scannedreturn: true, scannedreturnby: localStorage.getItem('lrp_driver') || 'Unknown' };
  
          audioRef.current?.play().catch(() => {}); // ✅ Safe beep

          setTicket(prev => ({ ...prev, ...updatedFields }));
          setShowSuccess(true);
          setSnackbar({ open: true, message: `✅ ${scanType} scanned!`, severity: 'success' });

          setTimeout(() => {
            setModalOpen(false);
            resetScanner();
          }, 300);
        } else {
          setSnackbar({ open: true, message: '❌ Failed to update scan', severity: 'error' });
          setModalOpen(false);
          resetScanner();
        }
      })
      .catch(() => {
        setSnackbar({ open: true, message: '🚨 API error', severity: 'error' });
        setModalOpen(false);
        resetScanner();
      })
      .finally(() => setConfirming(false));
  };
  

  const toggleTorch = useCallback(async () => {
    try {
      const scanner = html5QrCodeRef.current;
      if (scanner && scanner.applyVideoConstraints) {
        await scanner.applyVideoConstraints({ advanced: [{ torch: !torchOn }] });
        setTorchOn(!torchOn);
      }
    } catch {}
  }, [torchOn]);

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        🎯 Ticket Scanner
      </Typography>

      {/* ✅ Persistent audio element */}
      <audio ref={audioRef} src={beepSound} preload="auto" style={{ display: 'none' }} />

      <ToggleButtonGroup value={scanType} exclusive onChange={(e, val) => val && setScanType(val)} fullWidth sx={{ mb: 2 }}>
        <ToggleButton value="outbound">⬅️ Outbound</ToggleButton>
        <ToggleButton value="return">➡️ Return</ToggleButton>
      </ToggleButtonGroup>

      {cameraError ? (
        <Alert severity="error">
          📵 Camera access not available. <Button onClick={() => window.location.reload()}>Reload</Button>
        </Alert>
      ) : (
        <Paper sx={{ p: 2, mb: 2 }} elevation={4}>
          <Box
            id="qr-reader"
            sx={{ width: '100%', height: 'auto', '& > video': { width: '100%', height: 'auto', objectFit: 'cover', transform: 'none !important' }, '& canvas': { display: 'none !important' } }}
          />
          <Box display="flex" justifyContent="space-between" mt={2}>
            <Button variant="outlined" onClick={toggleTorch}>{torchOn ? '🔦 Torch Off' : '💡 Torch On'}</Button>
            {cameras.length > 1 && (
              <Button variant="outlined" onClick={() => {
                const currentIdx = cameras.findIndex(cam => cam.id === currentCameraId);
                const next = cameras[(currentIdx + 1) % cameras.length];
                stopScanner().then(() => {
                  initScanner(next.id);
                  setCurrentCameraId(next.id);
                });
              }}>
                🔁 Switch Camera
              </Button>
            )}
          </Box>
        </Paper>
      )}

      {loading && <CircularProgress sx={{ display: 'block', mx: 'auto', mb: 2 }} />}

      <Modal open={modalOpen} onClose={() => {
        setModalOpen(false);
        setTimeout(() => resetScanner(), 200);
      }}>
        <Box sx={{ backgroundColor: 'background.paper', borderRadius: 2, p: 4, width: 360, mx: 'auto', mt: '10vh', boxShadow: 24, outline: 'none' }}>
          {ticket ? (
            <>
              <Box display="flex" justifyContent="center" mb={2}>
                <QRCode value={`https://lakeridepros.xyz/ticket/${ticket.ticketId}`} size={120} />
              </Box>
              <Typography variant="h6" fontWeight="bold" gutterBottom align="center">
                🎟️ {ticket.ticketId}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography><strong>Passenger:</strong> {ticket.passenger}</Typography>
              <Typography><strong>Passenger Count:</strong> {ticket.passengercount}</Typography>
              <Typography><strong>Date:</strong> {formatDate(ticket.date)}</Typography>
              <Typography><strong>Time:</strong> {formatTime(ticket.time)}</Typography>
              <Typography><strong>Pickup:</strong> {ticket.pickup}</Typography>
              <Typography><strong>Dropoff:</strong> {ticket.dropoff}</Typography>
              {ticket.notes && <Typography><strong>Notes:</strong> {ticket.notes}</Typography>}
              <Typography sx={{ mt: 1 }}>
                <strong>Outbound:</strong> {ticket.scannedoutbound ? `✅ by ${ticket.scannedoutboundby || '—'}` : '❌ Not Scanned'}
              </Typography>
              <Typography>
                <strong>Return:</strong> {ticket.scannedreturn ? `✅ by ${ticket.scannedreturnby || '—'}` : '❌ Not Scanned'}
              </Typography>
              <Button
                fullWidth
                onClick={confirmTicket}
                sx={{ mt: 2 }}
                variant="contained"
                disabled={confirming || (scanType === 'outbound' ? ticket.scannedoutbound : ticket.scannedreturn)}
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
        <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', bgcolor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Typography variant="h2" fontWeight="bold" color="success.main">
            ✅ Scanned
          </Typography>
        </Box>
      </Fade>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
