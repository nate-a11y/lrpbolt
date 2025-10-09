import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

import PageContainer from "@/components/PageContainer.jsx";
import LrpGrid from "@/components/datagrid/LrpGrid.jsx";
import { useAuth } from "@/context/AuthContext.jsx";
import logError from "@/utils/logError.js";
import { dayjs, tsToDayjs, timestampSortComparator } from "@/utils/timeUtils.js";
import {
  saveHyperlaneScore,
  subscribeTopHyperlaneScores,
  subscribeWeeklyHyperlaneScores,
  subscribeUserWeeklyHyperlaneBest,
} from "@/services/games.js";

const BRAND_GREEN = "#4cbb17";
const BACKGROUND = "#060606";

const gridSx = {
  bgcolor: "transparent",
  color: "#fff",
  border: 0,
  "& .MuiDataGrid-cell": { borderColor: "rgba(255,255,255,0.08)" },
  "& .MuiDataGrid-columnHeaders": { bgcolor: "rgba(255,255,255,0.04)" },
  "& .MuiDataGrid-row:hover": { bgcolor: "rgba(255,255,255,0.06)" },
  "& .MuiDataGrid-virtualScroller": { backgroundColor: "transparent" },
};

export default function GamesHyperlane() {
  const iframeRef = useRef(null);
  const { user } = useAuth();

  const [reloadKey, setReloadKey] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [topScores, setTopScores] = useState([]);
  const [topLoading, setTopLoading] = useState(true);
  const [topError, setTopError] = useState(null);
  const [weeklyScores, setWeeklyScores] = useState([]);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [weeklyError, setWeeklyError] = useState(null);
  const [userBest, setUserBest] = useState(null);
  const [userBestLoading, setUserBestLoading] = useState(true);
  const [userBestError, setUserBestError] = useState(null);
  const [lastScore, setLastScore] = useState(null);
  const [copying, setCopying] = useState(false);
  const [snack, setSnack] = useState(null);

  const tzGuess = useMemo(() => dayjs.tz?.guess?.() || "UTC", []);
  const startOfWeek = useMemo(() => dayjs().tz(tzGuess).startOf("week"), [tzGuess]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("lrp_hyperlane_sound");
      if (stored === "off") {
        setSoundEnabled(false);
      } else if (stored === "on") {
        setSoundEnabled(true);
      }
    } catch (error) {
      logError(error, { where: "GamesHyperlane.initSound" });
    }
  }, []);

  const sendSoundSetting = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      iframe.contentWindow?.postMessage(
        {
          type: "HYPERLANE_SOUND_TOGGLE",
          enabled: soundEnabled,
        },
        "*",
      );
    } catch (error) {
      logError(error, { where: "GamesHyperlane.sendSoundSetting" });
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          "lrp_hyperlane_sound",
          soundEnabled ? "on" : "off",
        );
      } catch (error) {
        logError(error, { where: "GamesHyperlane.persistSound" });
      }
    }
    sendSoundSetting();
  }, [sendSoundSetting, soundEnabled]);

  useEffect(() => {
    setTopLoading(true);
    const unsubscribe = subscribeTopHyperlaneScores({
      topN: 10,
      onData: (rows) => {
        setTopScores(Array.isArray(rows) ? rows : []);
        setTopLoading(false);
        setTopError(null);
      },
      onError: (error) => {
        setTopError(error?.message || "Failed to load high scores.");
        setTopLoading(false);
      },
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  useEffect(() => {
    setWeeklyLoading(true);
    const unsubscribe = subscribeWeeklyHyperlaneScores({
      topN: 10,
      startAt: startOfWeek,
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
  }, [startOfWeek]);

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

  useEffect(() => {
    const handleMessage = (event) => {
      const payload = event?.data;
      if (!payload || payload.type !== "HYPERLANE_SCORE") return;
      const value = Number(payload.score);
      if (!Number.isFinite(value)) return;
      setLastScore(value);
      saveHyperlaneScore(value).catch((error) => {
        logError(error, { where: "GamesHyperlane.saveScore", score: value });
        setSnack({
          open: true,
          severity: "error",
          message: "Score saved locally, but cloud sync failed.",
        });
      });
    };
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const overallRows = useMemo(
    () =>
      (Array.isArray(topScores) ? topScores : []).map((row, index) => ({
        id: row?.id || `overall-${index}`,
        ...row,
      })),
    [topScores],
  );

  const weeklyRows = useMemo(
    () =>
      (Array.isArray(weeklyScores) ? weeklyScores : []).map((row, index) => ({
        id: row?.id || `weekly-${index}`,
        ...row,
      })),
    [weeklyScores],
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
          if (!params?.api) return "N/A";
          const index = params.api.getRowIndexRelativeToVisibleRows(params.id);
          return Number.isInteger(index) ? index + 1 : "N/A";
        },
      },
      {
        field: "displayName",
        headerName: "Driver",
        flex: 1,
        valueGetter: (params) => {
          const name = params?.row?.displayName;
          return name && typeof name === "string" && name.trim()
            ? name
            : "Anonymous";
        },
      },
      {
        field: "score",
        headerName: "Score",
        width: 140,
        type: "number",
        valueGetter: (params) => {
          const value = Number(params?.row?.score);
          return Number.isFinite(value) ? value : null;
        },
        valueFormatter: (params) => {
          const value = Number(params?.value);
          return Number.isFinite(value) ? value.toLocaleString() : "N/A";
        },
      },
      {
        field: "createdAt",
        headerName: "Recorded",
        width: 220,
        valueGetter: (params) => params?.row?.createdAt ?? null,
        valueFormatter: (params) => {
          const parsed = tsToDayjs(params?.value);
          return parsed ? parsed.format("MMM D, YYYY h:mm A") : "N/A";
        },
        sortComparator: timestampSortComparator,
      },
    ],
    [],
  );

  const handleReload = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

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

  const handleSoundToggle = useCallback((event) => {
    setSoundEnabled(event.target.checked);
  }, []);

  const handleIframeLoad = useCallback(() => {
    sendSoundSetting();
  }, [sendSoundSetting]);

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
  }, [copying, lastScore]);

  const handleSnackClose = useCallback((_, reason) => {
    if (reason === "clickaway") return;
    setSnack(null);
  }, []);

  const yourBestScore = Number(userBest?.score);
  const globalBestScore = Number(overallRows?.[0]?.score);
  const weeklyBestScore = Number(weeklyRows?.[0]?.score);

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
    if (weeklyLoading || topLoading) return "Leader: Loading…";
    if (weeklyError && topError) return "Leader: N/A";
    return "Leader: No scores yet";
  }, [globalBestScore, topError, topLoading, weeklyBestScore, weeklyError, weeklyLoading]);

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
      if (!rows || rows.length === 0) {
        return <Alert severity="info">{emptyMessage}</Alert>;
      }
      return (
        <LrpGrid
          rows={rows}
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

        <Stack direction={{ xs: "column", lg: "row" }} spacing={2.5} sx={{ flexGrow: 1 }}>
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
            <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="h6" sx={{ fontWeight: 700, color: BRAND_GREEN }}>
                    Pilot Console
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={soundEnabled}
                        onChange={handleSoundToggle}
                        sx={{
                          "& .MuiSwitch-switchBase.Mui-checked": {
                            color: BRAND_GREEN,
                          },
                          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                            bgcolor: `${BRAND_GREEN}90`,
                          },
                        }}
                      />
                    }
                    label="Sound"
                    sx={{
                      color: "#fff",
                      "& .MuiFormControlLabel-label": { fontWeight: 600 },
                    }}
                  />
                  <Tooltip title="Reload game">
                    <IconButton onClick={handleReload} sx={{ color: "#fff" }} aria-label="Reload game">
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Fullscreen">
                    <IconButton onClick={handleFullscreen} sx={{ color: "#fff" }} aria-label="Fullscreen">
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

              <Box
                sx={{
                  position: "relative",
                  width: "100%",
                  borderRadius: 2,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.06)",
                  aspectRatio: "4 / 3",
                  bgcolor: "#101010",
                }}
              >
                <Box
                  component="iframe"
                  key={reloadKey}
                  ref={iframeRef}
                  title="LRP Hyperlane"
                  src="/games/hyperlane/index.html"
                  sandbox="allow-scripts allow-pointer-lock allow-same-origin"
                  onLoad={handleIframeLoad}
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
                Controls: ← / → or tap the on-screen pads. Grab neon rings, dodge red blocks, and chase the hyperlane leaderboard.
              </Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
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
                  Scores auto-save to the cloud when you crash. Keep racing for the top spot!
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
              <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: BRAND_GREEN }}>
                    Top 10 — All Time
                  </Typography>
                  <Divider sx={{ mt: 1, borderColor: "rgba(255,255,255,0.08)" }} />
                </Box>
                {renderLeaderboard(
                  topLoading,
                  topError,
                  overallRows,
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
              <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: BRAND_GREEN }}>
                    Weekly Heat — Reset {startOfWeek.format("MMM D")}
                  </Typography>
                  <Divider sx={{ mt: 1, borderColor: "rgba(255,255,255,0.08)" }} />
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
