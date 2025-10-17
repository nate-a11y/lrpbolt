import { forwardRef, useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { Box } from "@mui/material";

import { useAuth } from "@/context/AuthContext.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import { submitHighscore, toNumberOrNull } from "@/services/gamesService.js";
import logError from "@/utils/logError.js";

function normalizeOrigin() {
  if (typeof window === "undefined") return "";
  const raw = import.meta.env.VITE_GAMES_ORIGIN || "/games";
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin;
  } catch (error) {
    logError(error, { where: "GamesBridge.normalizeOrigin" });
    return window.location.origin;
  }
}

function buildSrc(path, game) {
  const base = import.meta.env.VITE_GAMES_ORIGIN || "/games";
  const fallbackOrigin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const effectivePath = path || (game ? `${game}/index.html` : "");
  try {
    const baseUrl = new URL(base, fallbackOrigin);
    const cleanBase = baseUrl.href.replace(/\/+$/, "/");
    const cleanPath = effectivePath ? effectivePath.replace(/^\/+/, "") : "";
    return cleanPath
      ? `${cleanBase}${cleanPath}`
      : cleanBase.replace(/\/$/, "");
  } catch (error) {
    logError(error, {
      where: "GamesBridge.buildSrc",
      base,
      path: effectivePath,
    });
    const cleanBase = (base || "").replace(/\/+$/, "");
    const cleanPath = effectivePath ? effectivePath.replace(/^\/+/, "") : "";
    return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase || "/games";
  }
}

const GamesBridge = forwardRef(function GamesBridge(
  {
    game,
    path,
    height = 600,
    sx,
    onScore,
    sandbox = "allow-scripts allow-same-origin allow-popups allow-pointer-lock",
    allow = "fullscreen; gamepad; autoplay",
    onSaveSuccess,
    onSaveError,
    ...rest
  },
  ref,
) {
  const { user } = useAuth?.() || { user: null };
  const snack = useSnack?.();
  const showSnack = snack?.show;

  const gamesOrigin = useMemo(() => normalizeOrigin(), []);
  const iframeSrc = useMemo(() => buildSrc(path, game), [game, path]);
  const dedupeRef = useRef({ key: "", ts: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const allowedOrigins = new Set(
      [gamesOrigin, window.location?.origin].filter(Boolean),
    );

    const handleMessage = (event) => {
      try {
        if (!event?.data) return;
        if (allowedOrigins.size > 0 && !allowedOrigins.has(event.origin)) {
          return;
        }

        const {
          type,
          payload,
          score: legacyScore,
          game: legacyGame,
        } = event.data || {};
        const normalizedType = type || event.data?.type;

        if (
          normalizedType !== "lrp:game-highscore" &&
          normalizedType !== "HYPERLANE_SCORE"
        ) {
          return;
        }

        const incomingPayload =
          normalizedType === "HYPERLANE_SCORE"
            ? { score: legacyScore, game: legacyGame }
            : payload || {};
        const resolvedGame = incomingPayload?.game || game;
        if (!resolvedGame) return;

        const numericScore = toNumberOrNull(incomingPayload?.score);
        if (numericScore === null) return;

        const resolvedUid = incomingPayload?.uid || user?.uid || "anon";
        const dedupeKey = `${resolvedGame}:${resolvedUid}:${numericScore}`;
        const now = Date.now();
        if (
          dedupeRef.current.key === dedupeKey &&
          now - dedupeRef.current.ts < 3000
        ) {
          return;
        }
        dedupeRef.current = { key: dedupeKey, ts: now };

        onScore?.(numericScore);

        const payloadDisplayName =
          incomingPayload?.displayName &&
          typeof incomingPayload.displayName === "string"
            ? incomingPayload.displayName
            : undefined;

        submitHighscore({
          game: resolvedGame,
          uid: resolvedUid,
          displayName:
            payloadDisplayName ||
            user?.displayName ||
            user?.email ||
            "Anonymous",
          score: numericScore,
          version: incomingPayload?.version,
        })
          .then(() => {
            onSaveSuccess?.({
              game: resolvedGame,
              score: numericScore,
              uid: resolvedUid,
            });
            showSnack?.("Score saved!", "success");
          })
          .catch((error) => {
            dedupeRef.current = { key: "", ts: 0 };
            logError(error, {
              where: "GamesBridge.submitHighscore",
              resolvedGame,
            });
            onSaveError?.(error);
            showSnack?.("Could not save score", "error");
          });
      } catch (error) {
        logError(error, { where: "GamesBridge.handleMessage" });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [
    game,
    gamesOrigin,
    onSaveError,
    onSaveSuccess,
    onScore,
    showSnack,
    user?.displayName,
    user?.email,
    user?.uid,
  ]);

  const frameHeight = useMemo(() => {
    if (typeof height === "number") return `${height}px`;
    return height;
  }, [height]);

  return (
    <Box
      component="iframe"
      ref={ref}
      title={rest.title || `${game || "lrp-game"}-game`}
      src={iframeSrc}
      sandbox={sandbox}
      allow={allow}
      referrerPolicy="no-referrer"
      sx={{
        border: 0,
        width: "100%",
        height: frameHeight || "100%",
        ...sx,
      }}
      {...rest}
    />
  );
});

GamesBridge.propTypes = {
  game: PropTypes.string.isRequired,
  path: PropTypes.string,
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  sx: PropTypes.object,
  onScore: PropTypes.func,
  sandbox: PropTypes.string,
  allow: PropTypes.string,
  onSaveSuccess: PropTypes.func,
  onSaveError: PropTypes.func,
};

export default GamesBridge;
