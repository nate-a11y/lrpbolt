import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  Snackbar,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import RefreshIcon from "@mui/icons-material/Refresh";
import ShareIcon from "@mui/icons-material/Share";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";

import GamesBridge from "@/components/GamesBridge.jsx";
import PageContainer from "@/components/PageContainer.jsx";
import LrpGrid from "@/components/datagrid/LrpGrid.jsx";
import { highscoreColumns } from "@/columns/highscoreColumns.js";
import { useAuth } from "@/context/AuthContext.jsx";
import logError from "@/utils/logError.js";
import { startOfWeekLocal } from "@/utils/timeUtils.js";
import {
  subscribeTopHyperlaneAllTime,
  subscribeTopHyperlaneWeekly,
  subscribeUserWeeklyHyperlaneBest,
} from "@/services/games.js";
import { toNumberOrNull } from "@/services/gamesService.js";
import useGameSound from "@/hooks/useGameSound.js";

const BRAND_GREEN = "#4cbb17";
const BACKGROUND = "#060606";

const gridSx = {
  bgcolor: "transparent",
  color: "#fff",
  border: 0,
  "& .MuiDataGrid-cell": { borderColor: "rgba(255,255,255,0.08)" },
  "& .MuiDataGrid-columnHeaders": { bgcolor: "rgba(255,255,255,0.04)" },
  "& .MuiDataGrid-row.current-user": {
    bgcolor: "rgba(76,187,23,0.12)",
    "&:hover": { bgcolor: "rgba(76,187,23,0.18)" },
  },
  "& .MuiDataGrid-row:hover": { bgcolor: "rgba(255,255,255,0.06)" },
  "& .MuiDataGrid-virtualScroller": { backgroundColor: "transparent" },
};

const iframeContainerSx = {
  position: "relative",
  width: "100%",
  borderRadius: 2,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.06)",
  bgcolor: "#101010",
  aspectRatio: { xs: "3 / 4", md: "4 / 3" },
  minHeight: { xs: 420, sm: 480, md: 540 },
};

export default function GamesHyperlane() {
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
  const [userBestError, setUserBestError] = useState(null);
  const [lastScore, setLastScore] = useState(null);
  const [copying, setCopying] = useState(false);
  const [snack, setSnack] = useState(null);
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
      onError: (error) => {
        setAllTimeError(error?.message || "Failed to load high scores.");
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
      onError: (error) => {
        setWeeklyError(error?.message || "Failed to load weekly leaderboard.");
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
      setUserBestError(null);
      return undefined;
    }
    setUserBestLoading(true);
    const unsubscribe = subscribeUserWeeklyHyperlaneBest({
      uid: user.uid,
      startAt: startOfWeek,
      onData: (row) => {
        setUserBest(row);
        setUserBestLoading(false);
        setUserBestError(null);
      },
      onError: (error) => {
        setUserBestError(error?.message || "Failed to load your best score.");
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
            currentUid && row?.uid && row.uid === currentUid ? true : false;

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
    if (!iframe) return;
    const request = iframe.requestFullscreen || iframe.webkitRequestFullscreen;
    if (request) {
      Promise.resolve()
        .then(() => request.call(iframe))
        .catch((error) => {
          logError(error, { where: "GamesHyperlane.fullscreen" });
          setSnack({
            open: true,
            severity: "error",
            message: "Fullscreen not available in this browser.",
          });
        });
    }
  }, []);

  const handleShare = useCallback(async () => {
    if (!Number.isFinite(Number(lastScore))) {
      setSnack({
        open: true,
        severity: "info",
        message: "Play a run to share a score first.",
      });
      return;
    }
    if (copying) return;
    play("click");
    setCopying(true);
    try {
      if (typeof window === "undefined") {
        throw new Error("Clipboard unavailable");
      }
      const origin = window.location?.origin || "";
      const link = `${origin}/games?score=${Math.max(
        0,
        Math.floor(Number(lastScore)),
      )}`;
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard API not supported");
      }
      await navigator.clipboard.writeText(link);
      setSnack({
        open: true,
        severity: "success",
        message: "Link copied — go flex that score!",
      });
    } catch (error) {
      logError(error, { where: "GamesHyperlane.shareScore" });
      setSnack({
        open: true,
        severity: "error",
        message: "Couldn't copy link. Copy manually from the address bar.",
      });
    } finally {
      setCopying(false);
    }
  }, [copying, lastScore, play]);

  const handleSnackClose = useCallback((_, reason) => {
    if (reason === "clickaway") return;
    setSnack(null);
  }, []);

  const yourBestScore = toNumberOrNull(userBest?.score);
  const globalBestScore = toNumberOrNull(allTimeRows?.[0]?.score);
  const weeklyBestScore = toNumberOrNull(weeklyRows?.[0]?.score);

  const yourBestChipLabel = useMemo(() => {
    if (!user) return "Sign in to track your best this week";
    if (userBestLoading) return "Your best this week: Loading…";
    if (userBestError) return "Your best this week: N/A";
    return Number.isFinite(yourBestScore)
      ? `Your best this week: ${yourBestScore.toLocaleString()}`
      : "Your best this week: No score yet";
  }, [user, userBestLoading, userBestError, yourBestScore]);

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
    if (weeklyError && allTimeError) return "Leader: N/A";
    return "Leader: No scores yet";
  }, [
    globalBestScore,
    allTimeError,
    allTimeLoading,
    weeklyBestScore,
    weeklyError,
    weeklyLoading,
  ]);

  const lastScoreLabel = useMemo(() => {
    if (!Number.isFinite(Number(lastScore))) return "Last run: N/A";
    return `Last run: ${Math.floor(Number(lastScore)).toLocaleString()}`;
  }, [lastScore]);

  const renderLeaderboard = useCallback(
    (loading, errorMessage, rows, emptyMessage) => {
      if (loading) {
        return (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={32} color="inherit" />
          </Box>
        );
      }
      if (errorMessage) {
        return <Alert severity="error">{errorMessage}</Alert>;
      }
      const safeRows = Array.isArray(rows) ? rows : [];
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
          getRowClassName={getRowClassName}
        />
      );
    },
    [columns, getRowClassName],
  );

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
            LRP Hyperlane — Neon Runner
          </Typography>
        </Stack>

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
                flexGrow: 1,
                display: "flex",
                flexDirection: "column",
                gap: 2,
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
                    sx={{ fontWeight: 700, color: BRAND_GREEN }}
                  >
                    Pilot Console
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
                      aria-label="Reload game"
                    >
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Fullscreen">
                    <IconButton
                      onClick={handleFullscreen}
                      sx={{ color: "#fff" }}
                      aria-label="Fullscreen"
                    >
                      <OpenInFullIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                <Chip
                  label={yourBestChipLabel}
                  sx={{
                    bgcolor: "rgba(76,187,23,0.15)",
                    color: "#fff",
                    borderRadius: 1.5,
                    fontWeight: 600,
                  }}
                />
                <Chip
                  label={leaderChipLabel}
                  sx={{
                    bgcolor: "rgba(76,187,23,0.08)",
                    color: "#fff",
                    borderRadius: 1.5,
                    fontWeight: 600,
                  }}
                />
                <Chip
                  label={lastScoreLabel}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.08)",
                    color: "#fff",
                    borderRadius: 1.5,
                    fontWeight: 600,
                  }}
                />
              </Stack>

              <Box sx={iframeContainerSx}>
                <GamesBridge
                  key={`hyperlane-${reloadKey}`}
                  ref={iframeRef}
                  game="hyperlane"
                  path="hyperlane/index.html"
                  title="LRP Hyperlane"
                  height="100%"
                  onScore={(value) => setLastScore(value)}
                  onSaveError={(error) => {
                    logError(error, { where: "GamesHyperlane.saveScore" });
                    setSnack({
                      open: true,
                      severity: "error",
                      message: "Score saved locally, but cloud sync failed.",
                    });
                  }}
                  onError={(event) => {
                    logError(new Error("Hyperlane iframe failed"), {
                      where: "GamesHyperlane.iframeError",
                    });
                    setSnack({
                      open: true,
                      severity: "error",
                      message:
                        "Couldn't load the Hyperlane game. Try refreshing.",
                    });
                    if (event?.target?.removeAttribute) {
                      try {
                        event.target.removeAttribute("src");
                      } catch (iframeError) {
                        logError(iframeError, {
                          where: "GamesHyperlane.iframeCleanup",
                        });
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
                Controls: ← / → or tap the on-screen pads. Grab neon rings,
                dodge red blocks, and chase the hyperlane leaderboard.
              </Typography>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ xs: "stretch", sm: "center" }}
              >
                <Button
                  variant="contained"
                  onClick={handleShare}
                  startIcon={<ShareIcon />}
                  disabled={copying}
                  sx={{
                    bgcolor: BRAND_GREEN,
                    color: "#000",
                    fontWeight: 700,
                    px: 2.5,
                    "&:hover": { bgcolor: "#5fd62c" },
                  }}
                >
                  Share score link
                </Button>
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  Scores auto-save to the cloud when you crash. Keep racing for
                  the top spot!
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Stack direction="column" spacing={2.5} sx={{ flex: 1 }}>
            <Card
              sx={{
                flex: 1,
                bgcolor: "#0a0a0a",
                borderRadius: 2,
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <CardContent
                sx={{
                  flexGrow: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <Box>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: BRAND_GREEN }}
                  >
                    Top 10 — All Time
                  </Typography>
                  <Divider
                    sx={{ mt: 1, borderColor: "rgba(255,255,255,0.08)" }}
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
                bgcolor: "#0a0a0a",
                borderRadius: 2,
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <CardContent
                sx={{
                  flexGrow: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <Box>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: BRAND_GREEN }}
                  >
                    Weekly Heat — Reset {startOfWeek.format("MMM D")}
                  </Typography>
                  <Divider
                    sx={{ mt: 1, borderColor: "rgba(255,255,255,0.08)" }}
                  />
                </Box>
                {userBestError ? (
                  <Alert severity="warning">{userBestError}</Alert>
                ) : null}
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
      </Stack>
      <Snackbar
        open={Boolean(snack?.open)}
        autoHideDuration={5000}
        onClose={handleSnackClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {snack ? (
          <Alert
            onClose={handleSnackClose}
            severity={snack.severity || "info"}
            sx={{ width: "100%" }}
            variant="filled"
          >
            {snack.message}
          </Alert>
        ) : null}
      </Snackbar>
    </PageContainer>
  );
}
