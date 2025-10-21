import { forwardRef, useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { Box } from "@mui/material";

import { useAuth } from "@/context/AuthContext.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import { submitHighscore } from "@/services/gamesService.js";
import logError from "@/utils/logError.js";

function resolveFallbackOrigin() {
  return typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost";
}

function resolveGamesBase(explicitFallback) {
  const fallbackOrigin = explicitFallback || resolveFallbackOrigin();
  const envBase = import.meta.env.VITE_GAMES_ORIGIN;
  if (envBase) {
    try {
      return new URL(envBase, fallbackOrigin).href.replace(/\/+$/, "/");
    } catch (error) {
      logError(error, {
        where: "GamesBridge.resolveGamesBase.env",
        envBase,
      });
    }
  }

  const basePath = import.meta.env.BASE_URL || "/";
  try {
    const root = new URL(basePath, fallbackOrigin);
    const gamesUrl = new URL("games/", root);
    return gamesUrl.href.replace(/\/+$/, "/");
  } catch (error) {
    logError(error, {
      where: "GamesBridge.resolveGamesBase.base",
      basePath,
    });
    const originNormalized = fallbackOrigin.replace(/\/+$/, "/");
    const baseNormalized = String(basePath || "/")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "/");
    const prefix = baseNormalized
      ? `${originNormalized}/${baseNormalized.replace(/\/$/, "")}`
      : originNormalized;
    return `${prefix.replace(/\/+$/, "/")}games/`.replace(/\/+$/, "/");
  }
}

function computeGamesOrigin() {
  if (typeof window === "undefined") return "";
  try {
    const base = resolveGamesBase(window.location.origin);
    return new URL(base).origin;
  } catch (error) {
    logError(error, { where: "GamesBridge.computeGamesOrigin" });
    return window.location.origin;
  }
}

function buildSrc(path, game) {
  const fallbackOrigin = resolveFallbackOrigin();
  const baseHref = resolveGamesBase(fallbackOrigin);
  const effectivePath = path || (game ? `${game}/index.html` : "");
  const normalizedBase = baseHref.endsWith("/") ? baseHref : `${baseHref}/`;
  const cleanPath = effectivePath ? effectivePath.replace(/^\/+/, "") : "";
  if (!cleanPath) {
    return normalizedBase.replace(/\/$/, "");
  }
  return `${normalizedBase}${cleanPath}`;
}

const GamesBridge = forwardRef(function GamesBridge(
  {
    game,
    path,
    height = 600,
    sx,
    sandbox = "allow-scripts allow-same-origin allow-popups allow-pointer-lock",
    allow = "fullscreen; gamepad; autoplay",
    onScore,
    onSaveSuccess,
    onSaveError,
    ...rest
  },
  ref,
) {
  const { user } = useAuth?.() || { user: null };
  const snack = useSnack?.();
  const showSnack = snack?.show;

  const gamesOrigin = useMemo(() => computeGamesOrigin(), []);
  const iframeSrc = useMemo(() => buildSrc(path, game), [game, path]);
  const lastSaveRef = useRef({ key: "", ts: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleMessage = (event) => {
      try {
        if (!event?.data) return;

        const sameOrigin = event.origin === gamesOrigin;
        const devOrigin =
          gamesOrigin === window.location.origin &&
          event.origin === window.location.origin;
        if (!sameOrigin && !devOrigin) {
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

        const incoming =
          normalizedType === "HYPERLANE_SCORE"
            ? { score: legacyScore, game: legacyGame }
            : payload || {};

        const finalGame = incoming?.game || game;
        const numericScore = Number(incoming?.score);
        if (!finalGame || !Number.isFinite(numericScore) || numericScore < 0) {
          return;
        }

        const uid = user?.uid || "anon";
        const dedupeKey = `${finalGame}:${uid}:${numericScore}`;
        const now = Date.now();
        if (
          lastSaveRef.current.key === dedupeKey &&
          now - lastSaveRef.current.ts < 3000
        ) {
          return;
        }
        lastSaveRef.current = { key: dedupeKey, ts: now };

        onScore?.(numericScore);

        submitHighscore({
          game: finalGame,
          uid,
          displayName:
            incoming?.displayName ||
            user?.displayName ||
            user?.email ||
            "Anonymous",
          score: numericScore,
          version: incoming?.version,
        })
          .then(() => {
            showSnack?.("Score saved!", "success");
            onSaveSuccess?.({ game: finalGame, score: numericScore, uid });
          })
          .catch((error) => {
            lastSaveRef.current = { key: "", ts: 0 };
            logError(error, {
              where: "GamesBridge.submitHighscore",
              game: finalGame,
              score: numericScore,
            });
            showSnack?.("Could not save score", "error");
            onSaveError?.(error);
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
  sandbox: PropTypes.string,
  allow: PropTypes.string,
  onScore: PropTypes.func,
  onSaveSuccess: PropTypes.func,
  onSaveError: PropTypes.func,
};

export default GamesBridge;
