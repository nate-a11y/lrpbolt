import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  Link,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import RefreshIcon from "@mui/icons-material/Refresh";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";

import PageContainer from "@/components/PageContainer.jsx";
import LrpGrid from "@/components/datagrid/LrpGrid.jsx";
import logError from "@/utils/logError.js";
import { formatDateTime } from "@/utils/timeUtils.js";
import { subscribeTopHyperlaneAllTime } from "@/services/games.js";
import {
  saveHyperloopSession,
  subscribeTopHyperloopAllTime,
  subscribeTopHyperloopWeekly,
} from "@/services/games_hyperloop.js";
import useGameSound from "@/hooks/useGameSound.js";

const BACKGROUND = "#060606";
const BRAND_GREEN = "#4cbb17";

const gridSx = {
  bgcolor: "transparent",
  color: "#fff",
  border: 0,
  "& .MuiDataGrid-cell": { borderColor: "rgba(255,255,255,0.08)" },
  "& .MuiDataGrid-columnHeaders": { bgcolor: "rgba(255,255,255,0.04)" },
  "& .MuiDataGrid-row:hover": { bgcolor: "rgba(255,255,255,0.06)" },
  "& .MuiDataGrid-virtualScroller": { backgroundColor: "transparent" },
};

function HyperlanePanel() {
  const iframeRef = useRef(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [allTimeScores, setAllTimeScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { enabled: soundOn, setEnabled: setSoundOn, play } = useGameSound();

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeTopHyperlaneAllTime({
      topN: 10,
      onData: (rows) => {
        setAllTimeScores(Array.isArray(rows) ? rows : []);
        setLoading(false);
        setError(null);
      },
      onError: (err) => {
        setError(err?.message || "Unable to load Hyperlane leaderboard.");
        setLoading(false);
      },
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const onSound = (event) => {
      const data = event?.data;
      if (data?.type === "SOUND" && data?.name) {
        play(data.name);
      }
    };
    window.addEventListener("message", onSound);
    return () => {
      window.removeEventListener("message", onSound);
    };
  }, [play]);

  const rows = useMemo(
    () =>
      (Array.isArray(allTimeScores) ? allTimeScores : []).map((row, index) => {
        const fallbackId = `hyperlane-${index}`;
        const rawId = row?.id ?? fallbackId;
        const id =
          typeof rawId === "string" || typeof rawId === "number"
            ? rawId
            : fallbackId;
        const driver =
          typeof row?.driver === "string" && row.driver.trim()
            ? row.driver.trim()
            : typeof row?.displayName === "string" && row.displayName.trim()
              ? row.displayName.trim()
              : "Anonymous";
        const scoreValue = Number(row?.score);
        const score = Number.isFinite(scoreValue) ? scoreValue : null;
        return {
          ...row,
          id,
          rank: index + 1,
          driver,
          score,
          recorded: formatDateTime(row?.createdAt),
        };
      }),
    [allTimeScores],
  );

  const columns = useMemo(
    () => [
      {
        field: "rank",
        headerName: "#",
        width: 70,
        sortable: false,
        align: "center",
        headerAlign: "center",
      },
      {
        field: "driver",
        headerName: "Driver",
        flex: 1,
        minWidth: 140,
      },
      {
        field: "score",
        headerName: "Score",
        width: 140,
        type: "number",
        valueFormatter: ({ value }) =>
          Number.isFinite(value) ? value.toLocaleString() : "N/A",
      },
      {
        field: "recorded",
        headerName: "Recorded",
        flex: 0.9,
        minWidth: 180,
      },
    ],
    [],
  );

  const handleReload = useCallback(() => {
    play("click");
    setReloadKey((prev) => prev + 1);
  }, [play]);

  const handleFullscreen = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe?.requestFullscreen) {
      iframe
        .requestFullscreen()
        .catch((err) =>
          logError(err, { where: "GamesHub.hyperlaneFullscreen" }),
        );
    }
  }, []);

  return (
    <Stack
      direction={{ xs: "column", lg: "row" }}
      spacing={2.5}
      sx={{ flexGrow: 1 }}
    >
      <Card
        sx={{
          flex: { xs: 1, lg: 1.5 },
          bgcolor: "#0a0a0a",
          borderRadius: 2,
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <CardContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            flexGrow: 1,
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <SportsEsportsIcon sx={{ color: BRAND_GREEN }} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                LRP Hyperlane — Neon Runner
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <FormControlLabel
                control={
                  <Switch
                    checked={soundOn}
                    onChange={(event) => setSoundOn(event.target.checked)}
                    color="success"
                    sx={{
                      "& .MuiSwitch-thumb": {
                        bgcolor: soundOn ? "#4cbb17" : "#555",
                      },
                    }}
                  />
                }
                label={
                  soundOn ? (
                    <VolumeUpIcon sx={{ color: "#4cbb17" }} />
                  ) : (
                    <VolumeOffIcon sx={{ color: "#777" }} />
                  )
                }
                labelPlacement="start"
              />
              <Tooltip title="Reload game">
                <IconButton
                  onClick={handleReload}
                  sx={{ color: "#fff" }}
                  aria-label="Reload Hyperlane"
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Fullscreen">
                <IconButton
                  onClick={handleFullscreen}
                  sx={{ color: "#fff" }}
                  aria-label="Open Hyperlane fullscreen"
                >
                  <OpenInFullIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          <Box
            sx={{
              position: "relative",
              width: "100%",
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.06)",
              bgcolor: "#101010",
              aspectRatio: { xs: "3 / 4", md: "4 / 3" },
              minHeight: { xs: 420, sm: 480, md: 520 },
            }}
          >
            <Box
              component="iframe"
              key={`hyperlane-${reloadKey}`}
              ref={iframeRef}
              title="LRP Hyperlane"
              src="/games/hyperlane/index.html"
              sandbox="allow-scripts allow-pointer-lock allow-same-origin"
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                border: 0,
              }}
            />
          </Box>

          <Typography variant="body2" sx={{ opacity: 0.85 }}>
            Controls: ← / → keys or tap. Collect rings for +100. Avoid red
            blocks.
          </Typography>
        </CardContent>
      </Card>

      <Card
        sx={{
          flex: { xs: 1, lg: 1 },
          bgcolor: "#0a0a0a",
          borderRadius: 2,
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: BRAND_GREEN }}>
            Top 10 — Hyperlane
          </Typography>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
          <LrpGrid
            rows={rows}
            columns={columns}
            loading={loading}
            sx={gridSx}
            hideFooter
            disableColumnMenu
          />
          {error ? (
            <Alert
              severity="error"
              variant="filled"
              sx={{ bgcolor: "#b71c1c" }}
            >
              {error}
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </Stack>
  );
}

function HyperloopPanel() {
  const iframeRef = useRef(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [src, setSrc] = useState("/games/hexgl/index.html");
  const [allTimeSessions, setAllTimeSessions] = useState([]);
  const [weeklySessions, setWeeklySessions] = useState([]);
  const [allTimeLoading, setAllTimeLoading] = useState(true);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [allTimeError, setAllTimeError] = useState(null);
  const [weeklyError, setWeeklyError] = useState(null);
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [hasLocalHexgl, setHasLocalHexgl] = useState(false);
  const showAssetNotice = !hasLocalHexgl && import.meta.env.DEV;
  const { enabled: soundOn, setEnabled: setSoundOn, play } = useGameSound();

  const checkLocalHexGL = useCallback(async () => {
    const requiredAssets = [
      "/games/hexgl/index.html",
      "/games/hexgl/bkcore/hexgl/HUD.js",
    ];
    try {
      const results = await Promise.all(
        requiredAssets.map(async (url) => {
          try {
            const res = await fetch(url, {
              method: "GET",
              cache: "no-store",
            });
            return res.ok;
          } catch (assetErr) {
            logError(assetErr, {
              where: "GamesHub.checkLocalHexGL.asset",
              url,
            });
            return false;
          }
        }),
      );
      return results.every(Boolean);
    } catch (err) {
      logError(err, { where: "GamesHub.checkLocalHexGL" });
      return false;
    }
  }, []);

  useEffect(() => {
    setAllTimeLoading(true);
    const unsubscribe = subscribeTopHyperloopAllTime({
      topN: 10,
      onData: (rows) => {
        setAllTimeSessions(Array.isArray(rows) ? rows : []);
        setAllTimeLoading(false);
        setAllTimeError(null);
      },
      onError: (err) => {
        setAllTimeError(
          err?.message || "Unable to load Hyperloop leaderboard.",
        );
        setAllTimeLoading(false);
      },
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const onSound = (event) => {
      const data = event?.data;
      if (data?.type === "SOUND" && data?.name) {
        play(data.name);
      }
    };
    window.addEventListener("message", onSound);
    return () => {
      window.removeEventListener("message", onSound);
    };
  }, [play]);

  useEffect(() => {
    setWeeklyLoading(true);
    const unsubscribe = subscribeTopHyperloopWeekly({
      topN: 10,
      onData: (rows) => {
        setWeeklySessions(Array.isArray(rows) ? rows : []);
        setWeeklyLoading(false);
        setWeeklyError(null);
      },
      onError: (err) => {
        setWeeklyError(
          err?.message || "Unable to load Hyperloop weekly leaderboard.",
        );
        setWeeklyLoading(false);
      },
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const intervalId = window.setInterval(() => {
      setElapsedMs((prev) => prev + 100);
    }, 100);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [running]);

  useEffect(() => {
    let active = true;
    (async () => {
      const ok = await checkLocalHexGL();
      if (!active) return;
      setHasLocalHexgl(ok);
      setSrc(
        ok ? "/games/hexgl/index.html" : "https://bkcore.github.io/HexGL/",
      );
    })();
    return () => {
      active = false;
    };
  }, [checkLocalHexGL, reloadKey]);

  const handleHexglScore = useCallback(
    async (event) => {
      const data = event?.data;
      if (!data || data.type !== "HEXGL_SCORE") {
        return;
      }
      const rawScore = Number(data.score);
      if (!Number.isFinite(rawScore)) {
        return;
      }
      if (saving) {
        return;
      }
      const normalized = Math.max(0, Math.round(rawScore));
      const durationMs = normalized * 100;
      const secondsValue = Math.round((durationMs / 1000) * 100) / 100;
      setRunning(false);
      setElapsedMs(durationMs);
      setSaving(true);
      try {
        await saveHyperloopSession(durationMs);
        setToast({
          message: `Race finished — Score ${secondsValue}s`,
          severity: "success",
        });
      } catch (err) {
        logError(err, { where: "GamesHub.autoSaveHyperloop" });
        setToast({
          message: "Failed to auto-save Hyperloop score.",
          severity: "error",
        });
      } finally {
        setSaving(false);
      }
    },
    [saving],
  );

  useEffect(() => {
    const listener = (event) => {
      void handleHexglScore(event);
    };
    window.addEventListener("message", listener);
    return () => {
      window.removeEventListener("message", listener);
    };
  }, [handleHexglScore]);

  const buildSessionRows = useCallback(
    (rows, prefix) =>
      (Array.isArray(rows) ? rows : []).map((row, index) => {
        const fallbackId = `${prefix}-${index}`;
        const rawId = row?.id ?? fallbackId;
        const id =
          typeof rawId === "string" || typeof rawId === "number"
            ? rawId
            : fallbackId;
        const driver =
          typeof row?.driver === "string" && row.driver.trim()
            ? row.driver.trim()
            : typeof row?.displayName === "string" && row.displayName.trim()
              ? row.displayName.trim()
              : "Anonymous";
        const durationValue = Number(row?.durationMs);
        const durationMs =
          Number.isFinite(durationValue) && durationValue >= 0
            ? durationValue
            : null;
        const seconds =
          typeof durationMs === "number"
            ? Math.round((durationMs / 1000) * 10) / 10
            : null;
        return {
          ...row,
          id,
          rank: index + 1,
          driver,
          durationMs,
          score: seconds,
          recorded: formatDateTime(row?.createdAt),
        };
      }),
    [],
  );

  const allTimeRows = useMemo(
    () => buildSessionRows(allTimeSessions, "hyperloop-all"),
    [allTimeSessions, buildSessionRows],
  );

  const weeklyRows = useMemo(
    () => buildSessionRows(weeklySessions, "hyperloop-weekly"),
    [weeklySessions, buildSessionRows],
  );

  const columns = useMemo(
    () => [
      {
        field: "rank",
        headerName: "#",
        width: 70,
        sortable: false,
        align: "center",
        headerAlign: "center",
      },
      {
        field: "driver",
        headerName: "Driver",
        flex: 1,
        minWidth: 140,
      },
      {
        field: "score",
        headerName: "Time (s)",
        width: 140,
        type: "number",
        valueFormatter: ({ value }) => {
          if (typeof value !== "number" || !Number.isFinite(value)) {
            return "N/A";
          }
          const rounded = Math.round(value * 10) / 10;
          const fixed = rounded.toFixed(1);
          return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
        },
      },
      {
        field: "recorded",
        headerName: "Recorded",
        flex: 0.9,
        minWidth: 180,
      },
    ],
    [],
  );

  const renderLeaderboard = useCallback(
    (loadingState, errorMessage, rowsList, emptyMessage) => {
      if (loadingState) {
        return (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} color="inherit" />
          </Box>
        );
      }
      if (errorMessage) {
        return <Alert severity="error">{errorMessage}</Alert>;
      }
      const safeRows = Array.isArray(rowsList) ? rowsList : [];
      if (safeRows.length === 0) {
        return <Alert severity="info">{emptyMessage}</Alert>;
      }
      return (
        <LrpGrid
          rows={safeRows}
          columns={columns}
          disableColumnMenu
          hideFooter
          disableRowSelectionOnClick
          sx={gridSx}
        />
      );
    },
    [columns],
  );

  const handleReload = useCallback(() => {
    play("click");
    setRunning(false);
    setElapsedMs(0);
    setReloadKey((prev) => prev + 1);
  }, [play]);

  const handleFullscreen = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe?.requestFullscreen) {
      iframe
        .requestFullscreen()
        .catch((err) =>
          logError(err, { where: "GamesHub.hyperloopFullscreen" }),
        );
    }
  }, []);

  const handleStart = useCallback(() => {
    play("start");
    setElapsedMs(0);
    setRunning(true);
    setToast({ message: "Session started — race hard!", severity: "info" });
  }, [play]);

  const handleEnd = useCallback(async () => {
    if (saving) return;
    setRunning(false);
    setSaving(true);
    try {
      await saveHyperloopSession(elapsedMs);
      setToast({
        message: `Saved session: ${Math.round((elapsedMs / 1000) * 10) / 10}s`,
        severity: "success",
      });
    } catch (err) {
      logError(err, { where: "GamesHub.saveHyperloopSession" });
      setToast({ message: "Failed to save session.", severity: "error" });
    } finally {
      setSaving(false);
    }
  }, [elapsedMs, saving]);

  const handleCloseToast = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <Stack
      direction={{ xs: "column", lg: "row" }}
      spacing={2.5}
      sx={{ flexGrow: 1 }}
    >
      <Card
        sx={{
          flex: { xs: 1, lg: 1.5 },
          bgcolor: "#0a0a0a",
          borderRadius: 2,
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <CardContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            flexGrow: 1,
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <SportsEsportsIcon sx={{ color: BRAND_GREEN }} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                LRP Hyperloop — HexGL (3D)
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <FormControlLabel
                control={
                  <Switch
                    checked={soundOn}
                    onChange={(event) => setSoundOn(event.target.checked)}
                    color="success"
                    sx={{
                      "& .MuiSwitch-thumb": {
                        bgcolor: soundOn ? "#4cbb17" : "#555",
                      },
                    }}
                  />
                }
                label={
                  soundOn ? (
                    <VolumeUpIcon sx={{ color: "#4cbb17" }} />
                  ) : (
                    <VolumeOffIcon sx={{ color: "#777" }} />
                  )
                }
                labelPlacement="start"
              />
              <Tooltip title="Reload game">
                <IconButton
                  onClick={handleReload}
                  sx={{ color: "#fff" }}
                  aria-label="Reload Hyperloop"
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Fullscreen">
                <IconButton
                  onClick={handleFullscreen}
                  sx={{ color: "#fff" }}
                  aria-label="Open Hyperloop fullscreen"
                >
                  <OpenInFullIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          <Box
            sx={{
              position: "relative",
              width: "100%",
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.06)",
              bgcolor: "#101010",
              aspectRatio: { xs: "16 / 9", md: "16 / 9" },
              minHeight: { xs: 320, sm: 360, md: 420 },
            }}
          >
            <Box
              component="iframe"
              key={`hyperloop-${reloadKey}-${src}`}
              ref={iframeRef}
              title="LRP Hyperloop — HexGL"
              src={src}
              sandbox="allow-scripts allow-pointer-lock allow-same-origin"
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                border: 0,
              }}
            />
          </Box>

          {showAssetNotice ? (
            <Alert
              severity="info"
              variant="outlined"
              sx={{
                borderColor: "rgba(76, 187, 23, 0.4)",
                bgcolor: "rgba(76, 187, 23, 0.08)",
                color: "#e8ffe1",
                "& .MuiAlert-icon": { color: BRAND_GREEN },
              }}
            >
              HexGL assets are streaming from bkcore.github.io because the local
              bundle is missing.{" "}
              <Link
                href="https://github.com/LakeRidePros/lrpbolt/blob/main/docs/setup-hexgl-assets.md"
                target="_blank"
                rel="noreferrer"
                sx={{ color: BRAND_GREEN, fontWeight: 700 }}
              >
                HexGL setup guide
              </Link>{" "}
              to download the assets before shipping.
            </Alert>
          ) : null}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              onClick={handleStart}
              disabled={running || saving}
              variant="contained"
              sx={{
                bgcolor: BRAND_GREEN,
                color: "#000",
                fontWeight: 800,
                "&:hover": { bgcolor: "#45a915" },
              }}
            >
              Start Session
            </Button>
            <Button
              onClick={handleEnd}
              disabled={!running || saving}
              variant="outlined"
              sx={{
                borderColor: BRAND_GREEN,
                color: BRAND_GREEN,
                fontWeight: 800,
                "&:hover": { borderColor: BRAND_GREEN },
              }}
            >
              End & Save Score
            </Button>
            <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 600 }}>
              Elapsed: {`${Math.round((elapsedMs / 1000) * 10) / 10}s`}
            </Typography>
          </Stack>

          {saving ? (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              Saving session…
            </Typography>
          ) : null}

          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            Tip: Arrow keys steer. Finishing a race now auto-saves your
            Hyperloop time.
          </Typography>
        </CardContent>
      </Card>

      <Card
        sx={{
          flex: { xs: 1, lg: 1 },
          bgcolor: "#0a0a0a",
          borderRadius: 2,
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: BRAND_GREEN }}>
            Top 10 — All Time
          </Typography>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
          {renderLeaderboard(
            allTimeLoading,
            allTimeError,
            allTimeRows,
            "No Hyperloop sessions yet. Be the first to set a record!",
          )}

          <Typography
            variant="h6"
            sx={{ fontWeight: 800, color: BRAND_GREEN, mt: 2 }}
          >
            Weekly Heat
          </Typography>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
          {renderLeaderboard(
            weeklyLoading,
            weeklyError,
            weeklyRows,
            "No weekly sessions yet. Jump into Hyperloop this week!",
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        {toast ? (
          <Alert
            onClose={handleCloseToast}
            severity={toast.severity}
            variant="filled"
            sx={{
              bgcolor: toast.severity === "error" ? "#b71c1c" : BRAND_GREEN,
              color: toast.severity === "error" ? "#fff" : "#000",
              fontWeight: 800,
            }}
          >
            {toast.message}
          </Alert>
        ) : null}
      </Snackbar>
    </Stack>
  );
}

export default function GamesHub() {
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const qp = url.searchParams.get("tab");
      const normalizedPath = url.pathname.replace(/\/+$/, "");
      if (qp === "hyperloop" || normalizedPath === "/games/hyperloop") {
        setTab(1);
      }
      if (url.searchParams.has("score")) {
        url.searchParams.delete("score");
        window.history.replaceState({}, "", `${normalizedPath || "/games"}`);
      }
    } catch (err) {
      logError(err, { where: "GamesHub.init" });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const targetPath = tab === 1 ? "/games/hyperloop" : "/games";
      let changed = false;
      if (url.pathname !== targetPath) {
        url.pathname = targetPath;
        changed = true;
      }
      if (url.searchParams.has("tab")) {
        url.searchParams.delete("tab");
        changed = true;
      }
      if (url.searchParams.has("score")) {
        url.searchParams.delete("score");
        changed = true;
      }
      if (changed) {
        const query = url.searchParams.toString();
        const next = `${url.pathname}${query ? `?${query}` : ""}`;
        window.history.replaceState({}, "", next);
      }
    } catch (err) {
      logError(err, { where: "GamesHub.syncTab", tab });
    }
  }, [tab]);

  const handleChange = useCallback((event, value) => {
    setTab(value);
  }, []);

  return (
    <PageContainer
      maxWidth={1400}
      sx={{
        bgcolor: BACKGROUND,
        color: "#fff",
        minHeight: "100%",
        py: { xs: 3, md: 4 },
      }}
    >
      <Stack spacing={3} sx={{ flexGrow: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <SportsEsportsIcon sx={{ color: BRAND_GREEN, fontSize: 28 }} />
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            LRP Games Hub
          </Typography>
        </Stack>

        <Tabs
          value={tab}
          onChange={handleChange}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label="Games tabs"
          sx={{
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            "& .MuiTab-root": {
              color: "rgba(255,255,255,0.7)",
              fontWeight: 700,
            },
            "& .Mui-selected": { color: BRAND_GREEN },
            "& .MuiTabs-indicator": { backgroundColor: BRAND_GREEN },
          }}
        >
          <Tab label="Hyperlane (2D)" />
          <Tab label="Hyperloop (3D)" />
        </Tabs>

        {tab === 0 ? <HyperlanePanel /> : <HyperloopPanel />}
      </Stack>
    </PageContainer>
  );
}
