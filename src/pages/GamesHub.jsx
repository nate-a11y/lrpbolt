import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import RefreshIcon from "@mui/icons-material/Refresh";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";

import PageContainer from "@/components/PageContainer.jsx";
import LrpGrid from "@/components/datagrid/LrpGrid.jsx";
import logError from "@/utils/logError.js";
import { tsToDayjs } from "@/utils/timeUtils.js";
import { subscribeTopHyperlaneScores } from "@/services/games.js";
import {
  saveHyperloopSession,
  subscribeTopHyperloopSessions,
} from "@/services/games_hyperloop.js";

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
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeTopHyperlaneScores({
      topN: 10,
      onData: (rows) => {
        setScores(Array.isArray(rows) ? rows : []);
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

  const rows = useMemo(
    () =>
      (Array.isArray(scores) ? scores : []).map((row, index) => {
        const fallbackId = `hyperlane-${index}`;
        const id =
          typeof row?.id === "string" || typeof row?.id === "number"
            ? row.id
            : fallbackId;
        const rank = Number.isFinite(Number(row?.rank))
          ? Number(row.rank)
          : index + 1;
        return {
          ...row,
          id,
          rank,
        };
      }),
    [scores],
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
        valueGetter: (params) => {
          const rank = Number(params?.row?.rank ?? params?.value);
          return Number.isFinite(rank) ? rank : null;
        },
        valueFormatter: (params) => {
          const value = Number(params?.value ?? params?.row?.rank);
          return Number.isFinite(value) ? value : "N/A";
        },
      },
      {
        field: "displayName",
        headerName: "Driver",
        flex: 1,
        valueGetter: (params) => {
          const raw = params?.row?.displayName;
          if (typeof raw === "string" && raw.trim()) {
            return raw.trim();
          }
          return "Anonymous";
        },
      },
      {
        field: "score",
        headerName: "Score",
        width: 140,
        valueGetter: (params) => {
          const value = Number(params?.row?.score ?? params?.value);
          return Number.isFinite(value) ? value : null;
        },
        valueFormatter: (params) => {
          const value = Number(params?.row?.score ?? params?.value);
          return Number.isFinite(value) ? value.toLocaleString() : "N/A";
        },
      },
      {
        field: "createdAt",
        headerName: "Recorded",
        width: 220,
        valueGetter: (params) =>
          params?.row?.createdAt ?? params?.value ?? null,
        valueFormatter: (params) => {
          const parsed = tsToDayjs(
            params?.row?.createdAt ?? params?.value ?? null,
          );
          return parsed ? parsed.format("MMM D, YYYY h:mm A") : "N/A";
        },
      },
    ],
    [],
  );

  const handleReload = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

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
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeTopHyperloopSessions({
      topN: 10,
      onData: (rows) => {
        setSessions(Array.isArray(rows) ? rows : []);
        setLoading(false);
        setError(null);
      },
      onError: (err) => {
        setError(err?.message || "Unable to load Hyperloop leaderboard.");
        setLoading(false);
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
    const controller = new AbortController();
    let active = true;
    async function resolveSrc() {
      try {
        const response = await fetch("/games/hexgl/index.html", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!active) return;
        if (response.ok) {
          setSrc("/games/hexgl/index.html");
          return;
        }
        setSrc("https://bkcore.github.io/HexGL/");
      } catch (err) {
        if (err?.name === "AbortError") return;
        logError(err, { where: "GamesHub.resolveHexgl" });
        if (active) {
          setSrc("https://bkcore.github.io/HexGL/");
        }
      }
    }
    resolveSrc();
    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadKey]);

  const rows = useMemo(
    () =>
      (Array.isArray(sessions) ? sessions : []).map((row, index) => {
        const fallbackId = `hyperloop-${index}`;
        const id =
          typeof row?.id === "string" || typeof row?.id === "number"
            ? row.id
            : fallbackId;
        return {
          ...row,
          id,
        };
      }),
    [sessions],
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
        valueGetter: (params) => {
          const api = params?.api;
          if (!api) return null;
          const index = api.getRowIndexRelativeToVisibleRows(params.id);
          return Number.isFinite(index) ? index + 1 : null;
        },
        valueFormatter: (params) => {
          const value = Number(params?.value);
          return Number.isFinite(value) ? value : "N/A";
        },
      },
      {
        field: "displayName",
        headerName: "Driver",
        flex: 1,
        valueGetter: (params) => {
          const raw = params?.row?.displayName;
          if (typeof raw === "string" && raw.trim()) {
            return raw.trim();
          }
          return "Anonymous";
        },
      },
      {
        field: "durationMs",
        headerName: "Time (s)",
        width: 140,
        valueGetter: (params) => {
          const value = Number(params?.row?.durationMs ?? params?.value);
          return Number.isFinite(value) ? value : null;
        },
        valueFormatter: (params) => {
          const value = Number(params?.row?.durationMs ?? params?.value);
          if (!Number.isFinite(value)) return "N/A";
          return `${Math.round((value / 1000) * 10) / 10}`;
        },
      },
      {
        field: "createdAt",
        headerName: "Recorded",
        width: 220,
        valueGetter: (params) =>
          params?.row?.createdAt ?? params?.value ?? null,
        valueFormatter: (params) => {
          const parsed = tsToDayjs(
            params?.row?.createdAt ?? params?.value ?? null,
          );
          return parsed ? parsed.format("MMM D, YYYY h:mm A") : "N/A";
        },
      },
    ],
    [],
  );

  const handleReload = useCallback(() => {
    setRunning(false);
    setElapsedMs(0);
    setReloadKey((prev) => prev + 1);
  }, []);

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
    setElapsedMs(0);
    setRunning(true);
    setToast({ message: "Session started — race hard!", severity: "info" });
  }, []);

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
            Tip: Arrow keys steer. Scores currently track session duration. Once
            HexGL is local, we&apos;ll capture in-game scores automatically.
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
            Top 10 — Hyperloop
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
