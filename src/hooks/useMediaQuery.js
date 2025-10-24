import React from "react";
import { useTheme } from "@mui/material/styles";

const emptySubscription = () => () => {};

const sanitizeQuery = (theme, queryInput) => {
  if (!queryInput) {
    return "";
  }
  const resolved =
    typeof queryInput === "function" ? queryInput(theme) : queryInput;
  if (!resolved) {
    return "";
  }
  return String(resolved).replace(/^@media( ?)/m, "");
};

const getMatchFromMediaQuery = (matchMedia, query, defaultMatches) => {
  if (!matchMedia || !query) {
    return defaultMatches;
  }
  try {
    return matchMedia(query).matches;
  } catch {
    return defaultMatches;
  }
};

export default function useMediaQuery(queryInput, options = {}) {
  const theme = useTheme();
  const {
    defaultMatches = false,
    matchMedia: overrideMatchMedia,
    ssrMatchMedia = null,
    noSsr = false,
  } = options;

  const query = React.useMemo(
    () => sanitizeQuery(theme, queryInput),
    [theme, queryInput],
  );

  const supportMatchMedia =
    typeof window !== "undefined" && typeof window.matchMedia === "function";
  const matchMedia = React.useMemo(() => {
    if (overrideMatchMedia) {
      return overrideMatchMedia;
    }
    if (!supportMatchMedia) {
      return null;
    }
    return (queryString) => window.matchMedia(queryString);
  }, [overrideMatchMedia, supportMatchMedia]);

  const getDefaultSnapshot = React.useCallback(
    () => defaultMatches,
    [defaultMatches],
  );

  const getServerSnapshot = React.useMemo(() => {
    if (noSsr && matchMedia && query) {
      return () => getMatchFromMediaQuery(matchMedia, query, defaultMatches);
    }
    if (ssrMatchMedia && query) {
      try {
        const match = ssrMatchMedia(query);
        return () =>
          typeof match?.matches === "boolean" ? match.matches : defaultMatches;
      } catch {
        return getDefaultSnapshot;
      }
    }
    return getDefaultSnapshot;
  }, [
    defaultMatches,
    getDefaultSnapshot,
    matchMedia,
    noSsr,
    query,
    ssrMatchMedia,
  ]);

  const [getSnapshot, subscribe] = React.useMemo(() => {
    if (!matchMedia || !query) {
      return [getDefaultSnapshot, emptySubscription];
    }
    let mediaQueryList;
    try {
      mediaQueryList = matchMedia(query);
    } catch {
      return [getDefaultSnapshot, emptySubscription];
    }
    if (!mediaQueryList) {
      return [getDefaultSnapshot, emptySubscription];
    }
    const getSnapshotFn = () => mediaQueryList.matches;
    const subscribeFn = (notify) => {
      mediaQueryList.addEventListener("change", notify);
      return () => {
        mediaQueryList.removeEventListener("change", notify);
      };
    };
    return [getSnapshotFn, subscribeFn];
  }, [getDefaultSnapshot, matchMedia, query]);

  const getFallbackSnapshot = React.useCallback(() => {
    return getMatchFromMediaQuery(matchMedia, query, defaultMatches);
  }, [defaultMatches, matchMedia, query]);

  const match = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    noSsr ? getFallbackSnapshot : getServerSnapshot,
  );

  React.useDebugValue({ query, match });

  return match;
}
