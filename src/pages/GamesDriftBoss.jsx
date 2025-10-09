import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import RefreshIcon from "@mui/icons-material/Refresh";

import PageContainer from "@/components/PageContainer.jsx";
import LrpGrid from "@/components/datagrid/LrpGrid.jsx";
import logError from "@/utils/logError.js";
import { tsToDayjs, timestampSortComparator } from "@/utils/timeUtils.js";
import {
  saveDriftBossScore,
  subscribeTopDriftBossScores,
} from "@/services/games.js";

// eslint-disable-next-line import/no-unresolved
import driftBossHtml from "../../public/games/driftboss/index.html?raw";

const BRAND_GREEN = "#4cbb17";
const BACKGROUND = "#060606";

export default function GamesDriftBoss() {
  const iframeRef = useRef(null);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [inlineGame, setInlineGame] = useState(false);
  const [gameHtml, setGameHtml] = useState("");
  const [gameLoading, setGameLoading] = useState(true);
  const fallbackLoggedRef = useRef(false);

  const remoteGameUrl = useMemo(() => {
    const envUrl = import.meta?.env?.VITE_DRIFTBOSS_REMOTE_URL;
    if (typeof envUrl === "string" && envUrl.trim().length > 0) {
      return envUrl.trim();
    }
    const base = import.meta?.env?.BASE_URL || "/";
    const normalizedBase = base.endsWith("/") ? base : `${base}/`;
    return `${normalizedBase}games/driftboss/index.html`;
  }, []);

  const triggerInlineFallback = useCallback((reason) => {
    if (!fallbackLoggedRef.current) {
      fallbackLoggedRef.current = true;
      logError(new Error("Falling back to inline Drift Boss"), {
        where: "GamesDriftBoss.triggerInlineFallback",
        reason,
      });
    }
    setInlineGame(true);
    setGameHtml(driftBossHtml);
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeTopDriftBossScores({
      topN: 10,
      onData: (rows) => {
        if (!active) return;
        setScores(Array.isArray(rows) ? rows : []);
        setLoading(false);
        setError(null);
      },
      onError: (err) => {
        if (!active) return;
        const message = err?.message || "Failed to load top scores.";
        setError(message);
        setLoading(false);
      },
    });

    return () => {
      active = false;
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    const handleMessage = (event) => {
      const payload = event?.data;
      if (!payload || payload.type !== "DRIFTBOSS_SCORE") return;
      const rawScore = Number(payload.score);
      if (!Number.isFinite(rawScore)) return;
      saveDriftBossScore(rawScore).catch((err) => {
        logError(err, { where: "GamesDriftBoss.saveScore", score: rawScore });
      });
    };
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const rows = useMemo(() => {
    if (!Array.isArray(scores)) return [];
    return scores.map((row, index) => ({
      id: row?.id || String(index),
      displayName: row?.displayName || null,
      score: Number.isFinite(Number(row?.score)) ? Number(row.score) : null,
      createdAt: row?.createdAt || null,
    }));
  }, [scores]);

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
          return name && typeof name === "string" ? name : "Anonymous";
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
        width: 200,
        sortComparator: timestampSortComparator,
        valueGetter: (params) => params?.row?.createdAt || null,
        valueFormatter: (params) => {
          const date = tsToDayjs(params?.value);
          return date ? date.format("MMM D, h:mm A") : "N/A";
        },
      },
    ],
    [],
  );

  useEffect(() => {
    let active = true;
    if (typeof fetch !== "function") {
      triggerInlineFallback("fetch-unavailable");
      setGameLoading(false);
      return () => {
        active = false;
      };
    }

    const controller = new AbortController();
    setGameLoading(true);
    setInlineGame(false);
    setGameHtml("");

    const loadGameHtml = async () => {
      try {
        const response = await fetch(remoteGameUrl, {
          signal: controller.signal,
          credentials: "omit",
        });
        if (!active) return;
        if (!response.ok) {
          const error = new Error(
            `Remote Drift Boss returned ${response.status}`,
          );
          error.status = response.status;
          throw error;
        }
        const html = await response.text();
        if (!active) return;
        fallbackLoggedRef.current = false;
        setInlineGame(false);
        setGameHtml(html);
      } catch (err) {
        if (!active || err?.name === "AbortError") {
          return;
        }
        logError(err, {
          where: "GamesDriftBoss.loadRemoteGame",
          reason: "remote-fetch-failed",
          status: err?.status ?? err?.response?.status ?? null,
        });
        triggerInlineFallback("remote-fetch-failed");
      } finally {
        if (active) {
          setGameLoading(false);
        }
      }
    };

    loadGameHtml();

    return () => {
      active = false;
      controller.abort();
    };
  }, [remoteGameUrl, reloadKey, triggerInlineFallback]);

  const handleReload = useCallback(() => {
    fallbackLoggedRef.current = false;
    setGameLoading(true);
    setReloadKey((key) => key + 1);
  }, []);

  const handleFullscreen = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const node = iframe;
    if (node.requestFullscreen) {
      node.requestFullscreen().catch((err) => {
        logError(err, { where: "GamesDriftBoss.fullscreen" });
      });
    }
  }, []);

  return (
    <Box
      sx={{
        flexGrow: 1,
        bgcolor: BACKGROUND,
        minHeight: "100vh",
        py: { xs: 2, md: 3 },
      }}
    >
      <PageContainer
        maxWidth={1600}
        sx={{ width: "100%", bgcolor: "transparent" }}
      >
        <Stack spacing={2} sx={{ color: "#fff" }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: BRAND_GREEN }}>
            Games — Drift Boss
          </Typography>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{ alignItems: "stretch" }}
          >
            <Card
              sx={{
                flex: { xs: "1 1 auto", md: 2 },
                bgcolor: "#0a0a0a",
                borderRadius: 2,
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff",
              }}
            >
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 2 }}
                >
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 800, color: BRAND_GREEN }}
                  >
                    LRP Drift — Boss Mode
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Reload game">
                      <span>
                        <IconButton
                          size="small"
                          onClick={handleReload}
                          aria-label="Reload game"
                          disabled={gameLoading}
                          sx={{
                            color: "#fff",
                            border: "1px solid rgba(255,255,255,0.16)",
                          }}
                        >
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Full screen">
                      <span>
                        <IconButton
                          size="small"
                          onClick={handleFullscreen}
                          aria-label="Fullscreen"
                          disabled={gameLoading}
                          sx={{
                            color: "#fff",
                            border: "1px solid rgba(255,255,255,0.16)",
                          }}
                        >
                          <OpenInFullIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Stack>
                <Box
                  sx={{
                    position: "relative",
                    aspectRatio: "4 / 3",
                    width: "100%",
                    bgcolor: "#101010",
                    borderRadius: 2,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {gameLoading && (
                    <Stack
                      spacing={1}
                      alignItems="center"
                      justifyContent="center"
                      sx={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 1,
                        bgcolor: "rgba(6,6,6,0.72)",
                        color: "#fff",
                      }}
                    >
                      <CircularProgress size={24} sx={{ color: BRAND_GREEN }} />
                      <Typography
                        variant="caption"
                        sx={{ color: "rgba(255,255,255,0.72)" }}
                      >
                        Loading Drift Boss…
                      </Typography>
                    </Stack>
                  )}
                  <Box
                    component="iframe"
                    key={`${reloadKey}-${inlineGame ? "inline" : "remote"}`}
                    ref={iframeRef}
                    title="LRP Drift Boss"
                    srcDoc={gameHtml || driftBossHtml}
                    sandbox="allow-scripts allow-pointer-lock allow-same-origin"
                    sx={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      border: 0,
                      opacity: gameLoading ? 0 : 1,
                      transition: "opacity 200ms ease",
                    }}
                  />
                </Box>
                {inlineGame && (
                  <Alert
                    severity="warning"
                    sx={{
                      mt: 2,
                      bgcolor: "rgba(255, 193, 7, 0.12)",
                      color: "rgba(255,255,255,0.88)",
                      border: "1px solid rgba(255, 193, 7, 0.32)",
                    }}
                  >
                    Couldn&apos;t reach the remote Drift Boss build, so we
                    loaded the built-in offline copy instead.
                  </Alert>
                )}
                <Typography
                  variant="body2"
                  sx={{ mt: 2, color: "rgba(255,255,255,0.72)" }}
                >
                  Hold or tap to drift and release to straighten. Scores
                  auto-save when you crash — good luck! 🏁
                </Typography>
              </CardContent>
            </Card>

            <Card
              sx={{
                flex: { xs: "1 1 auto", md: 1 },
                bgcolor: "#0a0a0a",
                borderRadius: 2,
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff",
              }}
            >
              <CardContent
                sx={{
                  p: { xs: 2, md: 3 },
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 800, color: BRAND_GREEN, mb: 1 }}
                >
                  Top 10 Drift Boss Scores
                </Typography>
                <Divider
                  sx={{ borderColor: "rgba(255,255,255,0.12)", mb: 2 }}
                />
                {loading && (
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ mb: 2 }}
                  >
                    <CircularProgress size={16} sx={{ color: BRAND_GREEN }} />
                    <Typography
                      variant="caption"
                      sx={{ color: "rgba(255,255,255,0.7)" }}
                    >
                      Loading top scores…
                    </Typography>
                  </Stack>
                )}
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}
                {!loading && !error && rows.length === 0 && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No scores yet — jump in and set the first record!
                  </Alert>
                )}
                <Box sx={{ flexGrow: 1, minHeight: 320 }}>
                  <LrpGrid
                    rows={rows}
                    columns={columns}
                    loading={loading}
                    disableRowSelectionOnClick
                    autoHeight={false}
                    sx={{ flexGrow: 1, bgcolor: "transparent", color: "#fff" }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Stack>
        </Stack>
      </PageContainer>
    </Box>
  );
}
