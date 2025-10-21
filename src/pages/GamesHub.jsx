// allow-color-literal-file

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import RefreshIcon from "@mui/icons-material/Refresh";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";

import GamesBridge from "@/components/GamesBridge.jsx";
import LRPStarRunner from "@/components/LRPStarRunner.jsx";
import PageContainer from "@/components/PageContainer.jsx";
import LrpGrid from "@/components/datagrid/LrpGrid.jsx";
import { highscoreColumns } from "@/columns/highscoreColumns.js";
import useGameSound from "@/hooks/useGameSound.js";
import { subscribeTopHyperlaneAllTime } from "@/services/games.js";
import { toNumberOrNull } from "@/services/gamesService.js";
import logError from "@/utils/logError.js";

const BACKGROUND = (theme) => theme.palette.background.default;

const gridSx = (t) => ({
  bgcolor: "transparent",
  color: "text.primary",
  border: 0,
  "& .MuiDataGrid-cell": { borderColor: t.palette.divider },
  "& .MuiDataGrid-columnHeaders": {
    bgcolor: alpha(t.palette.common.white, 0.04),
  },
  "& .MuiDataGrid-row:hover": {
    bgcolor: alpha(t.palette.common.white, 0.06),
  },
  "& .MuiDataGrid-virtualScroller": { backgroundColor: "transparent" },
});

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
      (Array.isArray(allTimeScores) ? allTimeScores : [])
        .map((row, index) => {
          const fallbackId = `hyperlane-${index}`;
          const rawId = row?.id ?? fallbackId;
          const id =
            typeof rawId === "string" || typeof rawId === "number"
              ? rawId
              : fallbackId;
          const driverName =
            typeof row?.driver === "string" && row.driver.trim()
              ? row.driver.trim()
              : typeof row?.displayName === "string" && row.displayName.trim()
                ? row.displayName.trim()
                : "Anonymous";
          const score = toNumberOrNull(row?.score);
          const createdAt =
            row?.createdAt && typeof row.createdAt.toDate === "function"
              ? row.createdAt
              : null;
          if (!Number.isFinite(score) || score < 0 || !createdAt) {
            return null;
          }

          return {
            ...row,
            id,
            driver: driverName,
            displayName: driverName,
            score,
            createdAt,
          };
        })
        .filter(Boolean),
    [allTimeScores],
  );

  const columns = useMemo(() => highscoreColumns, []);

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
          bgcolor: (t) => t.palette.background.paper,
          borderRadius: 2,
          border: (t) => `1px solid ${t.palette.divider}`,
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
              <SportsEsportsIcon
                sx={{ color: (t) => t.palette.primary.main }}
              />
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
                    sx={(t) => ({
                      "& .MuiSwitch-thumb": {
                        bgcolor: soundOn
                          ? t.palette.primary.main
                          : t.palette.grey[700],
                      },
                    })}
                  />
                }
                label={
                  soundOn ? (
                    <VolumeUpIcon
                      sx={{ color: (t) => t.palette.primary.main }}
                    />
                  ) : (
                    <VolumeOffIcon sx={{ color: (t) => t.palette.grey[500] }} />
                  )
                }
                labelPlacement="start"
              />
              <Tooltip title="Reload game">
                <IconButton
                  onClick={handleReload}
                  sx={{ color: "text.primary" }}
                  aria-label="Reload Hyperlane"
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Fullscreen">
                <IconButton
                  onClick={handleFullscreen}
                  sx={{ color: "text.primary" }}
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
              border: (t) => `1px solid ${t.palette.divider}`,
              bgcolor: (t) => t.palette.background.paper,
              aspectRatio: { xs: "3 / 4", md: "4 / 3" },
              minHeight: { xs: 420, sm: 480, md: 520 },
            }}
          >
            <GamesBridge
              key={`hyperlane-${reloadKey}`}
              ref={iframeRef}
              game="hyperlane"
              path="hyperlane/index.html"
              title="LRP Hyperlane"
              height="100%"
              onError={(event) => {
                logError(new Error("Hyperlane iframe failed"), {
                  where: "GamesHub.iframeError",
                });
                if (event?.target?.removeAttribute) {
                  try {
                    event.target.removeAttribute("src");
                  } catch (error) {
                    logError(error, { where: "GamesHub.iframeCleanup" });
                  }
                }
              }}
              allowFullScreen
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
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
          bgcolor: (t) => t.palette.background.paper,
          borderRadius: 2,
          border: (t) => `1px solid ${t.palette.divider}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography
            variant="h6"
            sx={{ fontWeight: 800, color: (t) => t.palette.primary.main }}
          >
            Top 10 — Hyperlane
          </Typography>
          <Divider sx={{ borderColor: (t) => t.palette.divider }} />
          {loading ? (
            <Stack
              alignItems="center"
              justifyContent="center"
              sx={{ minHeight: 320 }}
            >
              <CircularProgress
                size={48}
                sx={{ color: (t) => t.palette.primary.main }}
              />
            </Stack>
          ) : error ? (
            <Alert
              severity="error"
              variant="filled"
              sx={{ bgcolor: (t) => t.palette.error.dark }}
            >
              {error}
            </Alert>
          ) : rows.length ? (
            <LrpGrid
              rows={rows}
              columns={columns}
              sx={gridSx}
              loading={false}
              hideFooter
              disableColumnMenu
            />
          ) : (
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              No Hyperlane scores yet. Be the first to take the top spot!
            </Typography>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

function StarRunnerPanel() {
  return (
    <Stack spacing={2.5} sx={{ width: "100%" }}>
      <Card
        sx={{
          flex: { xs: "0 1 auto", md: 2 },
          maxHeight: 680,
          overflow: "hidden",
          bgcolor: (t) => t.palette.background.paper,
          borderRadius: 2,
          border: (t) => `1px solid ${t.palette.divider}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <CardContent
          sx={{
            p: { xs: 1.5, sm: 2 },
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <SportsEsportsIcon sx={{ color: (t) => t.palette.primary.main }} />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              LRP StarRunner — Prototype
            </Typography>
          </Stack>
          <Divider sx={{ borderColor: (t) => t.palette.divider }} />
          <LRPStarRunner />
          <Typography variant="body2" sx={{ opacity: 0.75 }}>
            Dodge debris, collect orbs, and chase a new high score.
          </Typography>
        </CardContent>
      </Card>
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
      if (qp === "starrunner" || normalizedPath === "/games/starrunner") {
        setTab(1);
      }
      if (url.searchParams.has("tab")) {
        url.searchParams.delete("tab");
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
      const targetPath = tab === 1 ? "/games/starrunner" : "/games";
      let changed = false;
      if (url.pathname !== targetPath) {
        url.pathname = targetPath;
        changed = true;
      }
      if (url.searchParams.has("tab")) {
        url.searchParams.delete("tab");
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
        color: "text.primary",
        minHeight: "100%",
        py: { xs: 3, md: 4 },
      }}
    >
      <Stack spacing={3} sx={{ flexGrow: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <SportsEsportsIcon
            sx={{ color: (t) => t.palette.primary.main, fontSize: 28 }}
          />
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
            borderBottom: (t) => `1px solid ${t.palette.divider}`,
            "& .MuiTab-root": {
              color: "rgba(255,255,255,0.7)",
              fontWeight: 700,
            },
            "& .Mui-selected": { color: (t) => t.palette.primary.main },
            "& .MuiTabs-indicator": {
              backgroundColor: (t) => t.palette.primary.main,
            },
          }}
        >
          <Tab label="Hyperlane (2D)" />
          <Tab label="StarRunner (3D)" />
        </Tabs>

        {tab === 0 ? <HyperlanePanel /> : <StarRunnerPanel />}
      </Stack>
    </PageContainer>
  );
}
