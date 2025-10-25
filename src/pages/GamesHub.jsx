// allow-color-literal-file

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
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
import PageContainer from "@/components/PageContainer.jsx";
import LrpGrid from "@/components/datagrid/LrpGrid.jsx";
import { highscoreColumns } from "@/columns/highscoreColumns.js";
import { useAuth } from "@/context/AuthContext.jsx";
import useGameSound from "@/hooks/useGameSound.js";
import {
  subscribeTopHyperlaneAllTime,
  subscribeTopHyperlaneWeekly,
  subscribeUserWeeklyHyperlaneBest,
} from "@/services/games.js";
import { toNumberOrNull } from "@/services/gamesService.js";
import { startOfWeekLocal } from "@/utils/timeUtils.js";
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
  "& .MuiDataGrid-row.current-user": {
    bgcolor: alpha(t.palette.primary.main, 0.12),
    "&:hover": { bgcolor: alpha(t.palette.primary.main, 0.18) },
  },
  "& .MuiDataGrid-row:hover": {
    bgcolor: alpha(t.palette.common.white, 0.06),
  },
  "& .MuiDataGrid-virtualScroller": { backgroundColor: "transparent" },
});

function HyperlanePanel() {
  const iframeRef = useRef(null);
  const { user } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const [allTimeScores, setAllTimeScores] = useState([]);
  const [allTimeLoading, setAllTimeLoading] = useState(true);
  const [allTimeError, setAllTimeError] = useState(null);
  const [weeklyScores, setWeeklyScores] = useState([]);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [weeklyError, setWeeklyError] = useState(null);
  const [userBest, setUserBest] = useState(null);
  const [userBestLoading, setUserBestLoading] = useState(true);
  const [lastScore, setLastScore] = useState(null);
  const { enabled: soundOn, setEnabled: setSoundOn, play } = useGameSound();

  const startOfWeek = useMemo(() => startOfWeekLocal(), []);

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
    setAllTimeLoading(true);
    const unsubscribe = subscribeTopHyperlaneAllTime({
      topN: 10,
      onData: (rows) => {
        setAllTimeScores(Array.isArray(rows) ? rows : []);
        setAllTimeLoading(false);
        setAllTimeError(null);
      },
      onError: (err) => {
        setAllTimeError(err?.message || "Unable to load all-time leaderboard.");
        setAllTimeLoading(false);
      },
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  useEffect(() => {
    setWeeklyLoading(true);
    const unsubscribe = subscribeTopHyperlaneWeekly({
      topN: 10,
      onData: (rows) => {
        setWeeklyScores(Array.isArray(rows) ? rows : []);
        setWeeklyLoading(false);
        setWeeklyError(null);
      },
      onError: (err) => {
        setWeeklyError(err?.message || "Failed to load weekly leaderboard.");
        setWeeklyLoading(false);
      },
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setUserBest(null);
      setUserBestLoading(false);
      return undefined;
    }
    setUserBestLoading(true);
    const unsubscribe = subscribeUserWeeklyHyperlaneBest({
      uid: user.uid,
      startAt: startOfWeek,
      onData: (row) => {
        setUserBest(row);
        setUserBestLoading(false);
      },
      onError: (_err) => {
        setUserBest(null);
        setUserBestLoading(false);
      },
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [startOfWeek, user?.uid]);

  const currentUid = user?.uid || null;

  const buildLeaderboardRows = useCallback(
    (rows, prefix) =>
      (Array.isArray(rows) ? rows : [])
        .map((row, index) => {
          const fallbackId = `${prefix}-${index}`;
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
          const isCurrentUser =
            currentUid && row?.uid && row.uid === currentUid;

          return {
            ...row,
            id,
            driver: driverName,
            displayName: driverName,
            score,
            createdAt,
            isCurrentUser,
          };
        })
        .filter(Boolean),
    [currentUid],
  );

  const allTimeRows = useMemo(
    () => buildLeaderboardRows(allTimeScores, "hyperlane-all-time"),
    [allTimeScores, buildLeaderboardRows],
  );

  const weeklyRows = useMemo(
    () => buildLeaderboardRows(weeklyScores, "hyperlane-weekly"),
    [weeklyScores, buildLeaderboardRows],
  );

  const columns = useMemo(() => highscoreColumns, []);

  const getRowClassName = useCallback(
    (params) => (params?.row?.isCurrentUser ? "current-user" : ""),
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

  const yourBestScore = toNumberOrNull(userBest?.score);
  const globalBestScore = toNumberOrNull(allTimeRows?.[0]?.score);
  const weeklyBestScore = toNumberOrNull(weeklyRows?.[0]?.score);

  const yourBestChipLabel = useMemo(() => {
    if (!user) return "Sign in to track your best";
    if (userBestLoading) return "Your best: Loading…";
    return Number.isFinite(yourBestScore)
      ? `Your best: ${yourBestScore.toLocaleString()}`
      : "Your best: No score yet";
  }, [user, userBestLoading, yourBestScore]);

  const leaderChipLabel = useMemo(() => {
    const activeScore = Number.isFinite(weeklyBestScore)
      ? weeklyBestScore
      : Number.isFinite(globalBestScore)
        ? globalBestScore
        : null;
    if (Number.isFinite(activeScore)) {
      return `Leader: ${activeScore.toLocaleString()}`;
    }
    if (weeklyLoading || allTimeLoading) return "Leader: Loading…";
    return "Leader: No scores yet";
  }, [globalBestScore, allTimeLoading, weeklyBestScore, weeklyLoading]);

  const lastScoreLabel = useMemo(() => {
    if (!Number.isFinite(Number(lastScore))) return "Last run: N/A";
    return `Last run: ${Math.floor(Number(lastScore)).toLocaleString()}`;
  }, [lastScore]);

  const renderLeaderboard = useCallback(
    (loading, errorMessage, rows, emptyMessage) => {
      if (loading) {
        return (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={32} color="inherit" />
          </Box>
        );
      }
      if (errorMessage) {
        return (
          <Alert severity="error" sx={{ mt: 1 }}>
            {errorMessage}
          </Alert>
        );
      }
      const safeRows = Array.isArray(rows) ? rows : [];
      if (safeRows.length === 0) {
        return (
          <Alert severity="info" sx={{ mt: 1 }}>
            {emptyMessage}
          </Alert>
        );
      }
      return (
        <LrpGrid
          rows={safeRows}
          columns={columns}
          disableColumnMenu
          hideFooter
          disableRowSelectionOnClick
          sx={gridSx}
          getRowClassName={getRowClassName}
        />
      );
    },
    [columns, getRowClassName],
  );

  return (
    <Stack
      direction={{ xs: "column", lg: "row" }}
      spacing={{ xs: 2, sm: 2.5 }}
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
            p: { xs: 2, sm: 2.5 },
            display: "flex",
            flexDirection: "column",
            gap: { xs: 1.5, sm: 2 },
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
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: (t) => t.palette.primary.main,
                  fontSize: { xs: "1.1rem", sm: "1.25rem" },
                }}
              >
                Pilot Console
              </Typography>
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ flexWrap: "wrap", gap: 0.5 }}
            >
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
                  size="small"
                  aria-label="Reload Hyperlane"
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Fullscreen">
                <IconButton
                  onClick={handleFullscreen}
                  sx={{ color: "text.primary" }}
                  size="small"
                  aria-label="Open Hyperlane fullscreen"
                >
                  <OpenInFullIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ flexWrap: "wrap", gap: 1 }}
          >
            <Chip
              label={yourBestChipLabel}
              size="small"
              sx={{
                bgcolor: (t) => alpha(t.palette.primary.main, 0.15),
                color: "text.primary",
                borderRadius: 1.5,
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            />
            <Chip
              label={leaderChipLabel}
              size="small"
              sx={{
                bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                color: "text.primary",
                borderRadius: 1.5,
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            />
            <Chip
              label={lastScoreLabel}
              size="small"
              sx={{
                bgcolor: (t) => alpha(t.palette.common.white, 0.08),
                color: "text.primary",
                borderRadius: 1.5,
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            />
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
              minHeight: { xs: 360, sm: 420, md: 480 },
            }}
          >
            <GamesBridge
              key={`hyperlane-${reloadKey}`}
              ref={iframeRef}
              game="hyperlane"
              path="hyperlane/index.html"
              title="LRP Hyperlane"
              height="100%"
              onScore={(value) => setLastScore(value)}
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

          <Typography variant="body2" sx={{ opacity: 0.85, fontSize: "0.875rem" }}>
            Controls: ← / → keys or tap. Collect neon rings for +100. Dodge red
            blocks and chase the leaderboard!
          </Typography>
        </CardContent>
      </Card>

      <Stack direction="column" spacing={{ xs: 2, sm: 2.5 }} sx={{ flex: 1 }}>
        <Card
          sx={{
            flex: 1,
            bgcolor: (t) => t.palette.background.paper,
            borderRadius: 2,
            border: (t) => `1px solid ${t.palette.divider}`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <CardContent
            sx={{
              p: { xs: 2, sm: 2.5 },
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
            }}
          >
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: (t) => t.palette.primary.main,
                  fontSize: { xs: "1rem", sm: "1.25rem" },
                }}
              >
                Top 10 — All Time
              </Typography>
              <Divider
                sx={{ mt: 1, borderColor: (t) => t.palette.divider }}
              />
            </Box>
            {renderLeaderboard(
              allTimeLoading,
              allTimeError,
              allTimeRows,
              "No Hyperlane scores yet. Be the first to set a record!",
            )}
          </CardContent>
        </Card>

        <Card
          sx={{
            flex: 1,
            bgcolor: (t) => t.palette.background.paper,
            borderRadius: 2,
            border: (t) => `1px solid ${t.palette.divider}`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <CardContent
            sx={{
              p: { xs: 2, sm: 2.5 },
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
            }}
          >
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: (t) => t.palette.primary.main,
                  fontSize: { xs: "1rem", sm: "1.25rem" },
                }}
              >
                Weekly Heat — Reset {startOfWeek.format("MMM D")}
              </Typography>
              <Divider
                sx={{ mt: 1, borderColor: (t) => t.palette.divider }}
              />
            </Box>
            {renderLeaderboard(
              weeklyLoading,
              weeklyError,
              weeklyRows,
              "No weekly scores yet. Hit the Hyperlane to claim the crown!",
            )}
          </CardContent>
        </Card>
      </Stack>
    </Stack>
  );
}

function LakeCrossingPanel() {
  const iframeRef = useRef(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { enabled: soundOn, setEnabled: setSoundOn, play } = useGameSound();

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
          logError(err, { where: "GamesHub.lakeCrossingFullscreen" }),
        );
    }
  }, []);

  return (
    <Stack spacing={{ xs: 2, sm: 2.5 }} sx={{ width: "100%" }}>
      <Card
        sx={{
          flex: { xs: "0 1 auto", md: 2 },
          bgcolor: (t) => t.palette.background.paper,
          borderRadius: 2,
          border: (t) => `1px solid ${t.palette.divider}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <CardContent
          sx={{
            p: { xs: 2, sm: 2.5 },
            display: "flex",
            flexDirection: "column",
            gap: { xs: 1.5, sm: 2 },
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: (t) => t.palette.primary.main,
                  fontSize: { xs: "1.1rem", sm: "1.25rem" },
                }}
              >
                Lake Crossing
              </Typography>
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ flexWrap: "wrap", gap: 0.5 }}
            >
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
                  size="small"
                  aria-label="Reload Lake Crossing"
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Fullscreen">
                <IconButton
                  onClick={handleFullscreen}
                  sx={{ color: "text.primary" }}
                  size="small"
                  aria-label="Open Lake Crossing fullscreen"
                >
                  <OpenInFullIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          <Divider sx={{ borderColor: (t) => t.palette.divider }} />

          <Box
            sx={{
              position: "relative",
              width: "100%",
              borderRadius: 2,
              overflow: "hidden",
              border: (t) => `1px solid ${t.palette.divider}`,
              bgcolor: (t) => t.palette.background.paper,
              aspectRatio: { xs: "3 / 4", md: "4 / 3" },
              minHeight: { xs: 360, sm: 420, md: 480 },
            }}
          >
            <GamesBridge
              key={`lakecrossing-${reloadKey}`}
              ref={iframeRef}
              game="lakecrossing"
              path="lakecrossing/index.html"
              title="LRP Lake Crossing"
              height="100%"
              onError={(event) => {
                logError(new Error("Lake Crossing iframe failed"), {
                  where: "GamesHub.lakeCrossingIframeError",
                });
                if (event?.target?.removeAttribute) {
                  try {
                    event.target.removeAttribute("src");
                  } catch (error) {
                    logError(error, { where: "GamesHub.lakeCrossingCleanup" });
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

          <Typography variant="body2" sx={{ opacity: 0.85, fontSize: "0.875rem" }}>
            Navigate from parking lot to marina! Use arrow keys or tap buttons
            to dodge traffic and boats. Reach all 5 marina spots to level up!
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
      if (qp === "lakecrossing" || normalizedPath === "/games/lakecrossing") {
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
      const targetPath = tab === 1 ? "/games/lakecrossing" : "/games";
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
          <Tab label="Hyperlane" />
          <Tab label="Lake Crossing" />
        </Tabs>

        {tab === 0 ? <HyperlanePanel /> : <LakeCrossingPanel />}
      </Stack>
    </PageContainer>
  );
}
