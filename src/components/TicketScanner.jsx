/* Proprietary and confidential. See LICENSE. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ReplayIcon from "@mui/icons-material/Replay";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import FlashOffIcon from "@mui/icons-material/FlashOff";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import ImageIcon from "@mui/icons-material/Image";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";

import logError from "@/utils/logError.js";
import { playBeep } from "@/utils/sound.js";
import useLatestRef from "@/hooks/useLatestRef.js";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import { vibrateOk, vibrateWarn } from "@/utils/haptics.js";

const BASE_CONSTRAINTS = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    focusMode: "continuous",
    advanced: [{ torch: false }],
  },
};

const successOverlaySx = {
  position: "absolute",
  inset: 0,
  bgcolor: "rgba(76,187,23,0.12)",
  color: "#4cbb17",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 1.2,
  transition: "opacity 200ms ease",
};

function TicketScanner({
  onScan,
  onClose,
  sequential = true,
  autoPauseMs = 1200,
  beep = true,
  vibrate = true,
  showPreview = true,
}) {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [awaitingRestart, setAwaitingRestart] = useState(false);
  const [loadingCamera, setLoadingCamera] = useState(true);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [cooldown, setCooldown] = useState(false);

  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const readerRef = useRef(null);
  const cooldownRef = useRef(null);
  const lastResultRef = useRef({ text: "", ts: 0 });
  const fileInputRef = useRef(null);
  const startPromiseRef = useRef(null);

  const onScanRef = useLatestRef(onScan);
  const autoPauseRef = useLatestRef(autoPauseMs);
  const vibrateRef = useLatestRef(vibrate);
  const beepRef = useLatestRef(beep);
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
        console.warn("[TicketScanner] live region dispatch failed", error);
      }
    }
  }, []);

  const constraints = useMemo(() => {
    const base = JSON.parse(JSON.stringify(BASE_CONSTRAINTS));
    if (selectedDeviceId) {
      base.video.deviceId = { exact: selectedDeviceId };
    }
    return base;
  }, [selectedDeviceId]);

  const clearCooldown = useCallback(() => {
    if (cooldownRef.current) {
      clearTimeout(cooldownRef.current);
      cooldownRef.current = null;
    }
    setCooldown(false);
  }, []);

  const stopDecoding = useCallback(() => {
    clearCooldown();
    const controls = controlsRef.current;
    controlsRef.current = null;
    if (controls) {
      try {
        controls.stop();
      } catch (err) {
        logError(err, {
          area: "TicketScanner",
          action: "stopControls",
        });
      }
    }
    const videoEl = videoRef.current;
    const stream = videoEl?.srcObject;
    if (stream) {
      stream.getTracks?.().forEach((track) => {
        try {
          track.stop();
        } catch (err) {
          logError(err, {
            area: "TicketScanner",
            action: "stopTrack",
          });
        }
      });
    }
    if (videoEl) {
      videoEl.srcObject = null;
    }
    setTorchEnabled(false);
    setTorchSupported(false);
    startPromiseRef.current = null;
  }, [clearCooldown]);

  const applyTorch = useCallback(async (enable) => {
    const track = videoRef.current?.srcObject?.getVideoTracks?.()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: enable }] });
      setTorchEnabled(enable);
    } catch (err) {
      logError(err, {
        area: "TicketScanner",
        action: "toggleTorch",
        extra: { enable },
      });
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = all.filter((item) => item.kind === "videoinput");
      setDevices(videoDevices);
      if (!selectedDeviceId && videoDevices.length) {
        setSelectedDeviceId(videoDevices[0].deviceId || "");
      }
    } catch (err) {
      logError(err, {
        area: "TicketScanner",
        action: "enumerateDevices",
      });
    }
  }, [selectedDeviceId]);

  const handleDecode = useCallback(
    async (result) => {
      if (!result) return;
      const text = result.getText?.() || result.text || "";
      if (!text) return;
      const now = Date.now();
      const last = lastResultRef.current;
      if (last.text === text && now - last.ts < autoPauseRef.current) {
        if (vibrateRef.current) {
          vibrateWarn();
        }
        const duplicateMessage = "Duplicate scan ignored";
        announce(duplicateMessage);
        showSnack(duplicateMessage, "warning");
        return;
      }
      lastResultRef.current = { text, ts: now };
      const payload = {
        text,
        rawBytes: result.getRawBytes?.() || undefined,
      };
      setLastResult(payload);
      setCooldown(true);
      clearCooldown();
      cooldownRef.current = setTimeout(() => {
        setCooldown(false);
        cooldownRef.current = null;
      }, autoPauseRef.current);

      if (beepRef.current) {
        try {
          playBeep();
        } catch (err) {
          logError(err, {
            area: "TicketScanner",
            action: "playBeep",
          });
        }
      }
      if (vibrateRef.current) {
        vibrateOk();
      }

      announce("Ticket scanned");

      try {
        onScanRef.current?.(payload);
      } catch (err) {
        logError(err, {
          area: "TicketScanner",
          action: "onScan",
        });
      }

      stopDecoding();
      setAwaitingRestart(true);
      setPaused(true);
    },
    [
      announce,
      autoPauseRef,
      beepRef,
      clearCooldown,
      onScanRef,
      showSnack,
      stopDecoding,
      vibrateRef,
    ],
  );

  const startDecoding = useCallback(
    async (deviceId) => {
      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader();
      }
      if (!videoRef.current || startPromiseRef.current) return;
      setLoadingCamera(true);
      setErrorMessage("");
      setCameraDenied(false);
      try {
        const promise = readerRef.current.decodeFromConstraints(
          deviceId
            ? {
                ...constraints,
                video: {
                  ...constraints.video,
                  deviceId: { exact: deviceId },
                },
              }
            : constraints,
          videoRef.current,
          (value, err, controls) => {
            if (value) {
              handleDecode(value);
            } else if (err && !(err instanceof NotFoundException)) {
              logError(err, {
                area: "TicketScanner",
                action: "decode",
              });
            }
            if (controls && !controlsRef.current) {
              controlsRef.current = controls;
            }
          },
        );
        startPromiseRef.current = promise;
        const controls = await promise;
        controlsRef.current = controls;
        setPaused(false);
        setAwaitingRestart(false);
        const track = videoRef.current?.srcObject?.getVideoTracks?.()[0];
        const capabilities = track?.getCapabilities?.();
        setTorchSupported(!!capabilities?.torch);
        if (torchEnabled && capabilities?.torch) {
          await applyTorch(true);
        }
      } catch (err) {
        stopDecoding();
        setCameraDenied(err?.name === "NotAllowedError");
        setErrorMessage(err?.message || "Unable to start camera");
        if (err?.name === "NotAllowedError") {
          setPaused(true);
        }
        logError(err, {
          area: "TicketScanner",
          action: "start",
          extra: { deviceId },
        });
      } finally {
        setLoadingCamera(false);
        startPromiseRef.current = null;
      }
    },
    [applyTorch, constraints, handleDecode, stopDecoding, torchEnabled],
  );

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  useEffect(() => {
    if (paused) {
      stopDecoding();
      return () => {};
    }
    let cancelled = false;
    (async () => {
      await startDecoding(selectedDeviceId);
      if (cancelled) {
        stopDecoding();
      }
    })();
    return () => {
      cancelled = true;
      stopDecoding();
    };
  }, [paused, selectedDeviceId, startDecoding, stopDecoding]);

  useEffect(
    () => () => {
      stopDecoding();
    },
    [stopDecoding],
  );

  const handlePauseToggle = useCallback(() => {
    setAwaitingRestart(false);
    setPaused((prev) => !prev);
  }, []);

  const handleResume = useCallback(() => {
    setAwaitingRestart(false);
    setPaused(false);
  }, []);

  const handleDeviceChange = useCallback((event) => {
    setSelectedDeviceId(event.target.value);
  }, []);

  const handleTorchToggle = useCallback(() => {
    const next = !torchEnabled;
    setTorchEnabled(next);
    applyTorch(next);
  }, [applyTorch, torchEnabled]);

  const handleImagePick = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      try {
        if (!readerRef.current) {
          readerRef.current = new BrowserMultiFormatReader();
        }
        const result = await readerRef.current.decodeFromImageUrl(url);
        handleDecode(result);
      } catch (err) {
        logError(err, {
          area: "TicketScanner",
          action: "decodeImage",
        });
        setErrorMessage("Unable to read image. Try another file.");
      } finally {
        URL.revokeObjectURL(url);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [handleDecode],
  );

  const closeScanner = useCallback(() => {
    stopDecoding();
    setPaused(true);
    if (onClose) onClose();
  }, [onClose, stopDecoding]);

  return (
    <Stack spacing={3} sx={{ color: "#f5f5f5", py: 2 }}>
      <Box>
        <Typography
          variant="body2"
          sx={{ color: "rgba(255,255,255,0.72)", mb: 1 }}
        >
          Align the QR code within the frame. Tip: enable torch for low light.
        </Typography>
        <Box
          sx={{
            position: "relative",
            borderRadius: 2,
            overflow: "hidden",
            border: "1px solid rgba(76,187,23,0.45)",
            bgcolor: "rgba(0,0,0,0.6)",
            aspectRatio: { xs: "3 / 4", sm: "16 / 9" },
            maxWidth: 560,
            mx: "auto",
          }}
        >
          <Box
            component="video"
            ref={videoRef}
            muted
            playsInline
            autoPlay
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {loadingCamera && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(6,6,6,0.72)",
              }}
            >
              <CircularProgress size={28} sx={{ color: "#4cbb17" }} />
            </Box>
          )}
          {cooldown && (
            <Box sx={{ ...successOverlaySx }}>
              <Typography variant="h6" component="span">
                Scanned
              </Typography>
            </Box>
          )}
          {(cameraDenied || errorMessage) && !loadingCamera && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                bgcolor: "rgba(6,6,6,0.88)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                alignItems: "center",
                justifyContent: "center",
                px: 3,
                textAlign: "center",
              }}
            >
              <CameraAltIcon sx={{ fontSize: 44, color: "#4cbb17" }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {cameraDenied
                  ? "Camera access was blocked. Allow access to scan tickets."
                  : errorMessage || "Unable to start camera."}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "rgba(255,255,255,0.7)" }}
              >
                You can upload an image of the QR code instead.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Tooltip title={paused ? "Resume scanning" : "Pause scanning"}>
            <IconButton
              color="inherit"
              onClick={handlePauseToggle}
              sx={{
                bgcolor: paused
                  ? "rgba(76,187,23,0.18)"
                  : "rgba(255,255,255,0.1)",
                borderRadius: 2,
                alignSelf: "flex-start",
              }}
              aria-label={paused ? "Resume scanner" : "Pause scanner"}
            >
              {paused ? (
                <PlayArrowIcon sx={{ color: "#4cbb17" }} />
              ) : (
                <PauseIcon />
              )}
            </IconButton>
          </Tooltip>

          {torchSupported && (
            <Tooltip title={torchEnabled ? "Turn torch off" : "Turn torch on"}>
              <IconButton
                color="inherit"
                onClick={handleTorchToggle}
                sx={{
                  bgcolor: torchEnabled
                    ? "rgba(76,187,23,0.18)"
                    : "rgba(255,255,255,0.1)",
                  borderRadius: 2,
                }}
                aria-label={torchEnabled ? "Disable torch" : "Enable torch"}
              >
                {torchEnabled ? (
                  <FlashOffIcon sx={{ color: "#4cbb17" }} />
                ) : (
                  <FlashOnIcon />
                )}
              </IconButton>
            </Tooltip>
          )}

          <FormControl
            size="small"
            sx={{ minWidth: { xs: "100%", sm: 200 }, flex: 1 }}
            variant="outlined"
          >
            <InputLabel id="ticket-scanner-camera">Camera</InputLabel>
            <Select
              labelId="ticket-scanner-camera"
              label="Camera"
              value={selectedDeviceId}
              onChange={handleDeviceChange}
              MenuProps={{
                PaperProps: {
                  sx: { bgcolor: "#060606", color: "#fff" },
                },
              }}
            >
              {devices.length ? (
                devices.map((device) => (
                  <MenuItem key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(-4)}`}
                  </MenuItem>
                ))
              ) : (
                <MenuItem value="" disabled>
                  No cameras found
                </MenuItem>
              )}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            startIcon={<ImageIcon />}
            component="label"
            sx={{
              borderColor: "rgba(76,187,23,0.4)",
              color: "#4cbb17",
              fontWeight: 600,
            }}
          >
            Upload QR
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="image/*"
              onChange={handleImagePick}
            />
          </Button>
        </Stack>

        {!sequential && awaitingRestart && (
          <Button
            onClick={handleResume}
            startIcon={<ReplayIcon />}
            variant="contained"
            sx={{
              alignSelf: "flex-start",
              bgcolor: "#4cbb17",
              color: "#060606",
            }}
          >
            Scan again
          </Button>
        )}

        {showPreview && lastResult?.text && (
          <Box
            sx={{
              borderRadius: 2,
              px: 2,
              py: 1.5,
              bgcolor: "rgba(76,187,23,0.12)",
              border: "1px solid rgba(76,187,23,0.35)",
            }}
          >
            <Typography variant="subtitle2" sx={{ color: "#4cbb17" }}>
              Last scan
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
              {lastResult.text}
            </Typography>
          </Box>
        )}

        {onClose && (
          <Button
            onClick={closeScanner}
            startIcon={<CloseFullscreenIcon />}
            sx={{ alignSelf: "flex-start", color: "#4cbb17" }}
          >
            Close scanner
          </Button>
        )}
      </Stack>
    </Stack>
  );
}

export default TicketScanner;
